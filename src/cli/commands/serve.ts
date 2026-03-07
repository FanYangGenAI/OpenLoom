import { startGateway } from '../../gateway/server.js';

interface ServeOptions {
  port: string;
}

export async function serveCommand(options: ServeOptions): Promise<void> {
  const port = parseInt(options.port, 10);
  
  console.log(`Starting OpenLoom Gateway...`);
  
  await startGateway(port);
}
