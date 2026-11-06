import { getTeacherClient } from '@/lib/supabase';
import type {
  CreatedInvite,
  InvitePreview,
  WorkspaceDetails,
  WorkspaceRole,
  WorkspaceSummary,
} from '@/types/workspace';

/* Every workspace read and write goes through SECURITY DEFINER RPCs
 * (supabase/migrations/*_phase2c_workspaces.sql). */

type RawSummary = {
  id: string;
  name: string;
  role: WorkspaceRole;
  owner_name: string;
  member_count: number;
  joined_at: string;
};

export async function listMyWorkspaces(): Promise<WorkspaceSummary[]> {
  const { data, error } = await getTeacherClient().rpc('list_my_workspaces');
  if (error) throw error;
  return ((data ?? []) as unknown as RawSummary[]).map((w) => ({
    id: w.id,
    name: w.name,
    role: w.role,
    ownerName: w.owner_name,
    memberCount: w.member_count,
    joinedAt: w.joined_at,
  }));
}

type RawDetails = {
  id: string;
  name: string;
  role: WorkspaceRole;
  owner_id: string;
  created_at: string;
  members: { teacher_id: string; display_name: string; role: WorkspaceRole; joined_at: string }[];
  invites: { id: string; created_at: string; expires_at: string; use_count: number; created_by_name: string }[];
};

export async function getWorkspace(id: string): Promise<WorkspaceDetails> {
  const { data, error } = await getTeacherClient().rpc('get_workspace', { p_workspace_id: id });
  if (error) throw error;
  const w = data as unknown as RawDetails;
  return {
    id: w.id,
    name: w.name,
    role: w.role,
    ownerId: w.owner_id,
    createdAt: w.created_at,
    members: w.members.map((m) => ({
      teacherId: m.teacher_id,
      displayName: m.display_name,
      role: m.role,
      joinedAt: m.joined_at,
    })),
    invites: w.invites.map((i) => ({
      id: i.id,
      createdAt: i.created_at,
      expiresAt: i.expires_at,
      useCount: i.use_count,
      createdByName: i.created_by_name,
    })),
  };
}

export async function createWorkspace(name: string): Promise<string> {
  const { data, error } = await getTeacherClient().rpc('create_workspace', { p_name: name.trim() });
  if (error) throw error;
  return data;
}

export async function renameWorkspace(id: string, name: string): Promise<void> {
  const { error } = await getTeacherClient().rpc('rename_workspace', { p_workspace_id: id, p_name: name.trim() });
  if (error) throw error;
}

export async function deleteWorkspace(id: string): Promise<void> {
  const { error } = await getTeacherClient().rpc('delete_workspace', { p_workspace_id: id });
  if (error) throw error;
}

export async function leaveWorkspace(id: string): Promise<void> {
  const { error } = await getTeacherClient().rpc('leave_workspace', { p_workspace_id: id });
  if (error) throw error;
}

export async function removeWorkspaceMember(workspaceId: string, teacherId: string): Promise<void> {
  const { error } = await getTeacherClient().rpc('remove_workspace_member', {
    p_workspace_id: workspaceId,
    p_teacher_id: teacherId,
  });
  if (error) throw error;
}

/** Creates a 7-day invite link. The raw token is returned only this once. */
export async function createInvite(workspaceId: string): Promise<CreatedInvite> {
  const { data, error } = await getTeacherClient().rpc('create_workspace_invite', { p_workspace_id: workspaceId });
  if (error) throw error;
  const raw = data as unknown as { id: string; token: string; expires_at: string };
  return { id: raw.id, token: raw.token, expiresAt: raw.expires_at };
}

export async function revokeInvite(inviteId: string): Promise<void> {
  const { error } = await getTeacherClient().rpc('revoke_workspace_invite', { p_invite_id: inviteId });
  if (error) throw error;
}

type RawPreview = {
  workspace_id: string;
  workspace_name: string;
  invited_by: string;
  owner_name: string;
  member_count: number;
  expires_at: string;
  already_member: boolean;
};

export async function previewInvite(token: string): Promise<InvitePreview> {
  const { data, error } = await getTeacherClient().rpc('preview_workspace_invite', { p_token: token });
  if (error) throw error;
  const raw = data as unknown as RawPreview;
  return {
    workspaceId: raw.workspace_id,
    workspaceName: raw.workspace_name,
    invitedBy: raw.invited_by,
    ownerName: raw.owner_name,
    memberCount: raw.member_count,
    expiresAt: raw.expires_at,
    alreadyMember: raw.already_member,
  };
}

/** Joins the invite's workspace (idempotent). Returns the workspace id. */
export async function acceptInvite(token: string): Promise<string> {
  const { data, error } = await getTeacherClient().rpc('accept_workspace_invite', { p_token: token });
  if (error) throw error;
  return data;
}
