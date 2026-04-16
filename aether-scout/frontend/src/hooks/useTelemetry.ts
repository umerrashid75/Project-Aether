import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useTelemetry() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  
  const { data: aircraft = [] } = useSWR(`${apiUrl}/api/telemetry/aircraft`, fetcher, { refreshInterval: 5000 });
  const { data: vessels = [] } = useSWR(`${apiUrl}/api/telemetry/vessels`, fetcher, { refreshInterval: 5000 });
  
  return { aircraft, vessels };
}
