export async function statusCommand(): Promise<void> {
  // TODO: Query SQLite for recent scans
  console.log('OpenLoom Status');
  console.log('===============');
  console.log('No recent scans found.');
  console.log('\nRun "openloom scan <path>" to start a new scan.');
}
