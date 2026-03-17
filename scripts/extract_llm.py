#!/usr/bin/env python3
"""
文档和图片信息提取脚本
使用 LLM (gemini-2.5-flash) 提取摘要、关键词、时间、空间、人物实体
"""

import os
import json
import sqlite3
from pathlib import Path
from datetime import datetime
import subprocess
import requests
import base64
from PIL import Image
import io
import sys

# 配置
DB_PATH = '/Users/fanyang/.jarvis/data/demo-yangfan.db'
FACES_DIR = '/Users/fanyang/.jarvis/faces'
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')
GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

# 支持的文件类型
DOC_EXTS = {'.docx', '.doc', '.txt', '.md', '.markdown', '.html', '.htm'}
PDF_EXT = '.pdf'
IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'}

def get_files_to_process():
    """获取需要处理的文件"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # 获取所有文件（从files表）
    cursor.execute("""
        SELECT id, path, name, ext, file_type 
        FROM files 
        WHERE scan_id = 'demo-scan'
        ORDER BY id
    """)
    
    files = cursor.fetchall()
    conn.close()
    return [dict(f) for f in files]

def read_docx(file_path):
    """读取 docx 文件"""
    try:
        from docx import Document
        doc = Document(file_path)
        text = '\n'.join([p.text for p in doc.paragraphs])
        return text[:5000]  # 限制长度
    except Exception as e:
        return f"[Error reading docx: {e}]"

def read_pdf(file_path):
    """读取 PDF 文件"""
    try:
        from pypdf import PdfReader
        reader = PdfReader(file_path)
        text = ''
        for page in reader.pages[:10]:  # 前10页
            text += page.extract_text() + '\n'
        return text[:5000]
    except Exception as e:
        return f"[Error reading pdf: {e}]"

def read_text(file_path):
    """读取文本文件"""
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            return f.read()[:5000]
    except Exception as e:
        return f"[Error reading text: {e}]"

def read_markdown(file_path):
    """读取 Markdown 文件，解析 front matter"""
    try:
        import frontmatter
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            doc = frontmatter.load(f)
        
        # 提取 front matter 中的元数据
        metadata = dict(doc.metadata) if doc.metadata else {}
        
        # 提取正文内容
        content = str(doc.content)[:5000] if doc.content else ''
        
        # 将元数据添加到返回内容前面（供 LLM 使用）
        if metadata:
            meta_str = '\n'.join([f"{k}: {v}" for k, v in metadata.items()])
            return f"---METADATA---\n{meta_str}\n---CONTENT---\n{content}"
        return content
    except Exception as e:
        # 如果 front matter 解析失败，回退到普通文本读取
        return read_text(file_path)

def read_html(file_path):
    """读取 HTML 文件，使用 BeautifulSoup 解析"""
    try:
        from bs4 import BeautifulSoup
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            html_content = f.read()
        
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # 提取 meta 标签中的元数据
        metadata = {}
        for meta in soup.find_all('meta'):
            name = meta.get('name') or meta.get('property', '')
            content = meta.get('content', '')
            if name and content:
                metadata[name] = content
        
        # 提取标题
        title = soup.title.string if soup.title else ''
        if title:
            metadata['title'] = title
        
        # 提取正文（移除 script 和 style）
        for script in soup(['script', 'style']):
            script.decompose()
        
        text = soup.get_text(separator='\n', strip=True)[:5000]
        
        # 将元数据添加到返回内容前面
        if metadata:
            meta_str = '\n'.join([f"{k}: {v}" for k, v in metadata.items()])
            return f"---METADATA---\n{meta_str}\n---CONTENT---\n{text}"
        return text
    except Exception as e:
        return f"[Error reading html: {e}]"


# ============ Phase 2: 元数据提取函数 ============

def extract_docx_metadata(file_path):
    """提取 DOCX 文件的元数据"""
    try:
        from docx import Document
        doc = Document(file_path)
        
        # 获取核心属性
        core_props = doc.core_properties
        
        metadata = {
            'creator': core_props.author or '',
            'created_time': core_props.created.isoformat() if core_props.created else '',
            'last_modified_by': core_props.last_modified_by or '',
            'title': core_props.title or '',
            'modified_time': core_props.modified.isoformat() if core_props.modified else ''
        }
        return metadata
    except Exception as e:
        return {'error': str(e)}


def extract_pdf_metadata(file_path):
    """提取 PDF 文件的元数据"""
    try:
        from pypdf import PdfReader
        reader = PdfReader(file_path)
        
        metadata_obj = reader.metadata or {}
        
        metadata = {
            'creator': metadata_obj.get('/Author', ''),
            'created_time': metadata_obj.get('/CreationDate', ''),
            'last_modified_by': metadata_obj.get('/Creator', ''),
            'producer': metadata_obj.get('/Producer', ''),
            'title': metadata_obj.get('/Title', '')
        }
        return metadata
    except Exception as e:
        return {'error': str(e)}


def extract_markdown_metadata(file_path):
    """提取 Markdown 文件的 front matter 元数据"""
    try:
        import frontmatter
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            doc = frontmatter.load(f)
        
        # 提取 front matter 中的元数据
        metadata_dict = dict(doc.metadata) if doc.metadata else {}
        
        # 映射常见字段名
        metadata = {
            'creator': metadata_dict.get('author', metadata_dict.get('creator', '')),
            'created_time': metadata_dict.get('date', metadata_dict.get('created', metadata_dict.get('created_time', ''))),
            'title': metadata_dict.get('title', ''),
            'last_modified_by': metadata_dict.get('last_modified_by', '')
        }
        
        # 清理空值
        metadata = {k: str(v) if v else '' for k, v in metadata.items()}
        return metadata
    except Exception as e:
        return {'error': str(e)}


def extract_html_metadata(file_path):
    """提取 HTML 文件的 meta 标签元数据"""
    try:
        from bs4 import BeautifulSoup
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            html_content = f.read()
        
        soup = BeautifulSoup(html_content, 'html.parser')
        
        metadata = {
            'creator': '',
            'created_time': '',
            'title': ''
        }
        
        # 提取 meta 标签中的元数据
        for meta in soup.find_all('meta'):
            name = meta.get('name') or meta.get('property', '')
            content = meta.get('content', '')
            
            if name in ['author', 'creator']:
                metadata['creator'] = content
            elif name in ['date', 'publish-date', 'article:published_time']:
                metadata['created_time'] = content
            elif name == 'description':
                metadata['description'] = content
            elif name in ['og:title', 'twitter:title']:
                metadata['title'] = content
        
        return metadata
    except Exception as e:
        return {'error': str(e)}


def extract_file_metadata(file_path):
    """提取文件元数据（根据文件类型）"""
    ext = os.path.splitext(file_path)[1].lower()
    
    if ext == '.docx':
        return extract_docx_metadata(file_path)
    elif ext == '.pdf':
        return extract_pdf_metadata(file_path)
    elif ext in {'.md', '.markdown'}:
        return extract_markdown_metadata(file_path)
    elif ext in {'.html', '.htm'}:
        return extract_html_metadata(file_path)
    else:
        return {}

def get_file_metadata(file_path):
    """获取文件元数据"""
    try:
        stat = os.stat(file_path)
        return {
            'created_time': datetime.fromtimestamp(stat.st_birthtime).isoformat() if hasattr(stat, 'st_birthtime') else datetime.fromtimestamp(stat.st_ctime).isoformat(),
            'modified_time': datetime.fromtimestamp(stat.st_mtime).isoformat(),
            'size': stat.st_size
        }
    except Exception as e:
        return {'error': str(e)}

def extract_image_faces(image_path, file_name):
    """检测并提取图片中的人脸"""
    try:
        # 使用 PIL 检查图片
        img = Image.open(image_path)
        width, height = img.size
        
        # 简单的人脸检测（使用 PIL 的 face detection 在 macOS 上不可用）
        # 改用图像中心区域作为默认人脸区域（如果图片看起来像证件照）
        
        # 保存原图
        faces_info = []
        
        # 检查图片大小，判断是否可能是人像
        # 如果是证件照类型（4:3 或接近 3:4），假设人脸在中心
        aspect = width / height
        if 0.5 < aspect < 2.0 and min(width, height) > 200:
            # 中心裁剪人脸区域 (假设人脸在上半部分)
            face_box = (
                int(width * 0.25),
                int(height * 0.1),
                int(width * 0.75),
                int(height * 0.5)
            )
            
            face_img = img.crop(face_box)
            face_name = f"face_{file_name}"
            face_path = os.path.join(FACES_DIR, face_name)
            face_img.save(face_path)
            
            faces_info.append({
                'face_path': face_path,
                'source_image': file_name
            })
            print(f"  -> Extracted face: {face_name}")
        
        return faces_info
    except Exception as e:
        print(f"  -> Face extraction error: {e}")
        return []

def encode_image(image_path):
    """将图片编码为 base64"""
    try:
        with open(image_path, 'rb') as f:
            return base64.b64encode(f.read()).decode('utf-8')
    except Exception as e:
        return None

def call_gemini(prompt, content=None, image_path=None):
    """调用 Gemini API 进行信息提取"""
    try:
        # 构建请求
        contents = []
        
        # 添加图片（如果有）
        if image_path:
            image_data = encode_image(image_path)
            if image_data:
                contents.append({
                    "inline_data": {
                        "mime_type": "image/jpeg",
                        "data": image_data
                    }
                })
        
        # 添加文本 prompt
        contents.append({
            "text": prompt
        })
        
        payload = {
            "contents": [{"role": "user", "parts": contents}],
            "generationConfig": {
                "temperature": 0.1,
                "maxOutputTokens": 2048,
            }
        }
        
        url = f"{GEMINI_URL}?key={GEMINI_API_KEY}"
        
        headers = {'Content-Type': 'application/json'}
        
        response = requests.post(url, headers=headers, json=payload, timeout=60)
        
        if response.status_code == 200:
            result = response.json()
            text = result.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '')
            return text
        else:
            print(f"  -> Gemini API error: {response.status_code} {response.text}")
            return None
            
    except Exception as e:
        print(f"  -> Gemini call error: {e}")
        return None

def extract_document_info(file_path, file_name, file_type):
    """使用 LLM 提取文档信息"""
    print(f"Processing document: {file_name}")
    
    # Phase 2: 1. 提取文档内部元数据（更准确）
    doc_metadata = extract_file_metadata(file_path)
    print(f"  -> Document metadata: creator={doc_metadata.get('creator', 'N/A')[:20]}, created={doc_metadata.get('created_time', 'N/A')[:20]}")
    
    # 读取内容
    ext = os.path.splitext(file_path)[1].lower()
    if ext == '.docx':
        content = read_docx(file_path)
    elif ext in {'.md', '.markdown'}:
        content = read_markdown(file_path)
    elif ext in {'.html', '.htm'}:
        content = read_html(file_path)
    elif ext == '.pdf':
        content = read_pdf(file_path)
    else:
        content = read_text(file_path)
    
    if not content or content.startswith('[Error'):
        print(f"  -> Failed to read content: {content}")
        return None
    
    # Phase 2: 2. 获取文件系统元数据（作为备用）
    fs_metadata = get_file_metadata(file_path)
    print(f"  -> Filesystem metadata: created={fs_metadata.get('created_time', 'N/A')[:20]}")
    
    # Phase 2: 3. 合并：优先使用文档内部元数据
    created_time = doc_metadata.get('created_time') or fs_metadata.get('created_time')
    creator = doc_metadata.get('creator') or fs_metadata.get('creator')
    print(f"  -> Merged metadata: creator={creator[:20] if creator else 'N/A'}, created={created_time[:20] if created_time else 'N/A'}")
    
    # 构建 prompt - Phase 2: 增加 creation_location
    prompt = f"""你是一个文档分析专家。请分析以下文档，提取关键信息。

文件名: {file_name}
文件类型: {file_type}

文档内容（部分）:
{content[:3000]}

请以JSON格式返回以下信息（使用中文）:
{{
  "summary": "50字以内的一句话摘要",
  "keywords": "3-5个关键词，用逗号分隔",
  "time_entities": "涉及的具体时间（年月日等），没有则为空",
  "space_entities": "涉及的地点（城市、国家等），没有则为空",
  "person_entities": "涉及的人物（姓名），没有则为空",
  "author": "文档作者（如果有）",
  "created_date": "文档创建日期（如果有）",
  "creation_location": "文档可能创建/编辑的地点（如 office, home, university, city 等），从内容中推断，如果没有则为空字符串"
}}

只返回JSON，不要其他内容。"""

    result = call_gemini(prompt)
    
    if result:
        # 解析 JSON
        try:
            # 尝试提取 JSON 部分
            if '```json' in result:
                result = result.split('```json')[1].split('```')[0]
            elif '```' in result:
                result = result.split('```')[1].split('```')[0]
            
            info = json.loads(result.strip())
            
            # Phase 2: 合并文件元数据和 LLM 提取的信息
            # 使用优先合并后的元数据
            info['metadata'] = fs_metadata
            info['file_metadata'] = doc_metadata  # 保留原始文档内部元数据
            info['content_preview'] = content[:500]
            
            # 填充数据库新字段（使用已合并的 created_time 和 creator）
            if not info.get('created_time') and created_time:
                info['created_time'] = created_time
            if not info.get('creator') and creator:
                info['creator'] = creator
            
            print(f"  -> Extracted: {info.get('summary', 'N/A')[:50]}")
            print(f"  -> Creation location: {info.get('creation_location', 'N/A')[:30]}")
            return info
        except json.JSONDecodeError as e:
            print(f"  -> JSON parse error: {e}")
            print(f"  -> Raw result: {result[:200]}")
    
    return None

def extract_image_info(file_path, file_name):
    """使用 LLM 提取图片信息"""
    print(f"Processing image: {file_name}")
    
    # 提取人脸
    faces = extract_image_faces(file_path, file_name)
    
    # 获取元数据
    metadata = get_file_metadata(file_path)
    
    # 构建 prompt
    prompt = """你是一个图像分析专家。请分析这张图片，提取关键信息。

请以JSON格式返回以下信息（使用中文）:
{
  "summary": "50字以内的一句话图片描述",
  "keywords": "3-5个关键词，用逗号分隔",
  "time_entities": "图片中涉及的时间（如日历、钟表、季节等），没有则为空",
  "space_entities": "图片中的地点（背景、标志等），没有则为空",
  "person_entities": "图片中的人物（数量、特征描述），没有则为空"
}

只返回JSON，不要其他内容。"""

    result = call_gemini(prompt, image_path=file_path)
    
    if result:
        try:
            if '```json' in result:
                result = result.split('```json')[1].split('```')[0]
            elif '```' in result:
                result = result.split('```')[1].split('```')[0]
            
            info = json.loads(result.strip())
            info['metadata'] = metadata
            info['faces_extracted'] = len(faces)
            
            print(f"  -> Extracted: {info.get('summary', 'N/A')[:50]}")
            return info
        except json.JSONDecodeError as e:
            print(f"  -> JSON parse error: {e}")
    
    return None

def update_database(file_info, llm_result):
    """更新数据库"""
    if not llm_result:
        return
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Phase 2: 更新所有字段，包括新增的元数据字段
        cursor.execute("""
            UPDATE extractions 
            SET summary = ?,
                keywords = ?,
                time_entities = ?,
                space_entities = ?,
                person_entities = ?,
                raw_llm_response = ?,
                created_time = ?,
                creator = ?,
                creation_location = ?
            WHERE file_path = ?
        """, (
            llm_result.get('summary', ''),
            llm_result.get('keywords', ''),
            llm_result.get('time_entities', ''),
            llm_result.get('space_entities', ''),
            llm_result.get('person_entities', ''),
            json.dumps(llm_result),
            llm_result.get('created_time', ''),  # 从文件元数据提取
            llm_result.get('creator', ''),        # 从文件元数据提取 或 LLM推断
            llm_result.get('creation_location', ''),  # LLM 从内容推断
            file_info['file_path']  # 使用 file_path 字段
        ))
        
        conn.commit()
        print(f"  -> Database updated")
    except Exception as e:
        print(f"  -> Database error: {e}")
    finally:
        conn.close()

def main():
    print("=" * 50)
    print("Starting information extraction")
    print("=" * 50)
    
    # 检查 API key
    if not GEMINI_API_KEY:
        print("ERROR: GEMINI_API_KEY not set")
        return
    
    # 获取文件列表
    files = get_files_to_process()
    print(f"Total files to process: {len(files)}")
    
    # 分类处理
    doc_files = [f for f in files if f['file_type'] in ['document', 'pdf']]
    image_files = [f for f in files if f['file_type'] == 'image']
    
    print(f"Documents: {len(doc_files)}, Images: {len(image_files)}")
    
    processed = 0
    errors = 0
    skipped = 0
    
    # 先处理待处理的文件（summary 为空）
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # 获取需要重新处理的文件（summary 为空或出错）
    cursor.execute("""
        SELECT e.id, e.file_path, e.file_name, e.file_type, f.id as file_id
        FROM extractions e
        JOIN files f ON e.file_path = f.path
        WHERE e.summary = '' OR e.summary IS NULL
        ORDER BY e.id
    """)
    pending = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    print(f"Pending extractions: {len(pending)}")
    
    # 处理文档
    print("\n--- Processing Documents & PDFs ---")
    for i, f in enumerate(pending):
        print(f"[{i+1}/{len(pending)}] {f['file_name'][:40]}", end=" ", flush=True)
        
        if f['file_type'] in ['document', 'pdf']:
            result = extract_document_info(f['file_path'], f['file_name'], f['file_type'])
            if result:
                update_database(f, result)
                processed += 1
                print("✅")
            else:
                errors += 1
                print("❌")
    
    # 处理图片
    print("\n--- Processing Images ---")
    for i, f in enumerate(pending):
        if f['file_type'] == 'image':
            print(f"[{i+1}/{len(pending)}] {f['file_name'][:40]}", end=" ", flush=True)
            
            result = extract_image_info(f['file_path'], f['file_name'])
            if result:
                update_database(f, result)
                processed += 1
                print("✅")
            else:
                errors += 1
                print("❌")
    
    print("\n" + "=" * 50)
    print(f"Done! Processed: {processed}, Errors: {errors}")
    print("=" * 50)

if __name__ == '__main__':
    main()
