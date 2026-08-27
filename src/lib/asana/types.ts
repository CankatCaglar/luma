export type AsanaResource = {
  gid: string;
  resource_type?: string;
  name?: string;
};

export type AsanaUser = {
  gid: string;
  name: string;
  email?: string;
};

export type AsanaWorkspace = {
  gid: string;
  name: string;
};

export type AsanaSection = {
  gid: string;
  name: string;
};

export type AsanaEnumValue = {
  gid: string;
  name: string;
};

export type AsanaCustomField = {
  gid: string;
  name: string;
  resource_subtype?: string;
  display_value?: string | null;
  enum_value?: AsanaEnumValue | null;
  text_value?: string | null;
  enum_options?: AsanaEnumValue[];
};

export type AsanaCustomFieldSetting = {
  gid: string;
  custom_field: AsanaCustomField;
};

export type AsanaProject = {
  gid: string;
  name: string;
  permalink_url?: string;
  custom_field_settings?: AsanaCustomFieldSetting[];
};

export type AsanaTag = {
  gid: string;
  name: string;
  color?: string | null;
};

export type AsanaAttachment = {
  gid: string;
  name?: string;
  download_url?: string | null;
  view_url?: string | null;
  host?: string;
};

export type AsanaMembership = {
  section?: { gid: string; name: string };
  project?: { gid: string; name: string };
};

export type AsanaTask = {
  gid: string;
  name: string;
  completed: boolean;
  completed_at?: string | null;
  due_on?: string | null;
  created_at?: string;
  permalink_url?: string;
  html_notes?: string;
  resource_subtype?: string;
  memberships?: AsanaMembership[];
  custom_fields?: AsanaCustomField[];
  tags?: AsanaTag[];
  attachments?: AsanaAttachment[];
};

export type AsanaNextPage = {
  offset: string;
  path: string;
  uri: string;
};

export type AsanaListResponse<T> = {
  data: T[];
  next_page?: AsanaNextPage | null;
};

export type AsanaItemResponse<T> = {
  data: T;
};
