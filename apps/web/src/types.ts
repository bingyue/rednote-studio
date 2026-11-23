export type CoverConfig = {
  template: "editorial" | "minimal" | "memo";
  title: string;
  subtitle: string;
  background: string;
  foreground: string;
  accent: string;
  font_size: number;
  font: "serif" | "sans-serif";
  width: number;
  height: number;
  background_asset_id: string | null;
  crop_x: number;
  crop_y: number;
};
export type Post = {
  id: string;
  account_id: string;
  title: string;
  body: string;
  tags: string[];
  cover: CoverConfig;
  asset_ids: string[];
  revision: number;
  updated_at: string;
  is_demo: boolean;
};
export type Account = {
  id: string;
  name: string;
  niche: string;
  positioning: string;
  audience: string;
  tone: string;
  topics: string[];
  banned_words: string[];
  authorization: string;
  authorized: boolean;
  color: string;
  is_demo: boolean;
  profile: { alias: string; local_ref: string; status: string } | null;
  style_samples: { content: string }[];
  publication_count: number;
};
export type Skill = {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  version: string;
};
export type Patch = Partial<Pick<Post, "title" | "body" | "tags" | "cover">>;
export type SkillOutput = {
  summary: string;
  items: { title: string; detail: string; patch?: Patch }[];
  patch: Patch;
};
export type SkillRun = {
  id: string;
  skill_id: string;
  output: SkillOutput | null;
  input: Record<string, unknown>;
  status: string;
  provider: string;
  duration_ms: number;
  prompt_version: string;
  error: string | null;
  created_at: string;
};
export type Finding = {
  id: string;
  field: string;
  span_start: number;
  span_end: number;
  matched_text: string;
  risk_type: string;
  severity: string;
  explanation: string;
  suggestion: string;
  source: string;
  decision: { reason: string } | null;
};
export type Check = {
  id: string;
  revision: number;
  findings: Finding[];
  context_status: string;
};
export type Task = {
  id: string;
  post_id: string;
  account_id: string;
  account_name: string;
  version_id: string;
  revision: number;
  status: string;
  scheduled_at: string | null;
  updated_at: string;
  snapshot: Pick<Post, "title" | "body" | "tags" | "cover" | "asset_ids">;
  is_demo: boolean;
  publication: { url: string; evidence: string; is_demo: boolean } | null;
  events: {
    created_at: string;
    from_status: string;
    to_status: string;
    detail: string;
  }[];
};
export type Asset = {
  id: string;
  name: string;
  mime: string;
  width: number;
  height: number;
};
export const defaultCover: CoverConfig = {
  template: "editorial",
  title: "把灵感，\n写成作品",
  subtitle: "记录值得分享的日常",
  background: "#f3eddf",
  foreground: "#343c32",
  accent: "#f45b46",
  font_size: 90,
  font: "serif",
  width: 1080,
  height: 1440,
  background_asset_id: null,
  crop_x: 0.5,
  crop_y: 0.5,
};
export const statusName: Record<string, string> = {
  DRAFT: "待准备",
  READY: "已就绪",
  SCHEDULED_REMINDER: "定时提醒",
  PUBLISHING_ASSISTED: "人工发布中",
  PUBLISHED_CONFIRMED: "已人工确认",
  FAILED: "发布未完成",
  CANCELLED: "已取消",
};
