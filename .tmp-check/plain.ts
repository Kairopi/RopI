export default async function () {
  const plain = (s: string) =>
    s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/(^|[^\w*])\*(?!\s)(.+?)\*(?!\w)/g, '$1$2').replace(/`([^`]+)`/g, '$1').replace(/(^|\s)_(\S.*?)_(?=\s|[.,;:!?]|$)/g, '$1$2');
  const cases: [string, string][] = [
    ['happens *inside* an already-running environment', 'happens inside an already-running environment'],
    ['A cold start happens *before* your handler', 'A cold start happens before your handler'],
    ['This is **very** important', 'This is very important'],
    ['Set `MemorySize` to 1024', 'Set MemorySize to 1024'],
    ['memory x duration = 2 * 1 GB', 'memory x duration = 2 * 1 GB'],
    ['snake_case_name stays', 'snake_case_name stays'],
    ['an _important_ point.', 'an important point.'],
  ];
  for (const [input, want] of cases) {
    const got = plain(input);
    console.log(got === want ? 'PASS' : 'FAIL', JSON.stringify(got));
  }
}
