export type FormatCategory = 'image' | 'document' | 'vector' | 'icon';

export interface FormatOption {
  ext: string;
  name: string;
  category: FormatCategory;
  mime: string;
  description: string;
  lossless?: boolean;
  popular?: boolean;
  iconName?: string;
}

export interface ConversionSettings {
  quality: number; // 1 - 100
  width?: number;
  height?: number;
  maintainAspectRatio: boolean;
  dpi: number;
  grayscale: boolean;
  bgColor: string;
}

export type FileStatus = 'idle' | 'converting' | 'completed' | 'error';

export interface FileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  sourceExt: string;
  targetFormat: string;
  previewUrl?: string;
  status: FileStatus;
  progress: number;
  resultBlob?: Blob;
  downloadUrl?: string;
  resultFileName?: string;
  errorMessage?: string;
  settings: ConversionSettings;
}

export interface ProxyStatus {
  proxied: boolean;
  mode: string;
}

export interface LoadTestRequestResult {
  id: number;
  status_code: number;
  duration_ms: number;
  bytes: number;
  error: string | null;
  success: boolean;
  opaque?: boolean;
}

export interface LoadTestLatencyStats {
  min: number;
  avg: number;
  median_p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  max: number;
}

export interface LoadTestCodeSummary {
  '2xx': number;
  '3xx': number;
  '4xx': number;
  '5xx': number;
  errors: number;
  opaque?: number;
}

export interface LoadTestResult {
  target_url: string;
  method: string;
  execution_mode?: 'browser-direct' | 'edge' | string;
  total_requests: number;
  concurrency: number;
  total_duration_sec: number;
  successful_requests: number;
  failed_requests: number;
  success_rate_percent: number;
  requests_per_second: number;
  transfer_rate_kbps: number;
  total_bytes_transferred: number;
  latency_stats_ms: LoadTestLatencyStats;
  code_summary: LoadTestCodeSummary;
  status_distribution: Record<string, number>;
  opaque_responses?: number;
  fallback_notice?: string;
  timeline: LoadTestRequestResult[];
}

export interface IpDetailsResult {
  ip: string;
  ip_version: string;
  country: string;
  country_code: string;
  flag?: string;
  region: string;
  city: string;
  postal: string;
  lat: number;
  lon: number;
  timezone: string;
  isp: string;
  org: string;
  asn: string;
  reverse_dns: string;
  client_browser: string;
  client_os: string;
  user_agent?: string;
  headers: Record<string, string>;
}

export interface DomainAuditRecommendation {
  type: 'critical' | 'warning' | 'passed' | string;
  title: string;
  desc: string;
}

export interface DomainAuditResult {
  domain: string;
  target_url: string;
  status_code: number;
  ttfb_ms: number;
  http_version: string;
  server: string;
  scores: {
    da: number;
    pa: number;
    spam_score: number;
    seo_health: number;
    grade: string;
    da_rating: string;
  };
  serp_preview: {
    title: string;
    url: string;
    snippet: string;
  };
  on_page_seo: {
    title: string;
    title_length: number;
    meta_description: string;
    meta_description_length: number;
    canonical_url: string;
    h1_count: number;
    h1_samples: string[];
    h2_count: number;
    h3_count: number;
    word_count: number;
    total_images: number;
    images_missing_alt: number;
    has_viewport: boolean;
    has_opengraph: boolean;
    og_title: string;
    og_image: string;
  };
  ssl: {
    valid: boolean;
    issuer: string;
    subject?: string;
    expiry_date?: string | null;
    days_left: number | null;
    is_expired: boolean;
    tls_version: string;
    error?: string;
  };
  security_headers: Record<string, boolean>;
  technical: {
    robots_txt: boolean;
    sitemap_xml: boolean;
    dns_a_records: string[];
    server_ip: string;
    encoding: string;
  };
  recommendations: DomainAuditRecommendation[];
}

export interface MultipartPartUrl {
  part_number: number;
  upload_url: string;
}

export interface UploadSessionData {
  file_id: string;
  filename: string;
  file_size: number;
  content_type?: string;
  upload_url: string;
  upload_mode: 'single' | 'multipart';
  storage_type: 'r2' | 'local';
  expires_at: number;
  delete_token: string;
  expiry_days: number;
  upload_id?: string;
  part_size?: number;
  parts?: MultipartPartUrl[];
}
