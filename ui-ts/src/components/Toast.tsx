interface ToastProps {
  message: string;
  type: 'info' | 'success' | 'error';
}

export function Toast({ message, type }: ToastProps) {
  if (!message) return null;
  return <div className={`toast toast-${type}`}>{message}</div>;
}
