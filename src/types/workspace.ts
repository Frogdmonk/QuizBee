export type WorkspaceRole = 'owner' | 'member';

/** view < copy < edit (edit is the highest level). */
export type QuizAccess = 'view' | 'copy' | 'edit';

/** What the signed-in teacher may do with one quiz. */
export type QuizRole = 'owner' | QuizAccess;

export type WorkspaceSummary = {
  id: string;
  name: string;
  role: WorkspaceRole;
  ownerName: string;
  memberCount: number;
  joinedAt: string;
};

export type WorkspaceMember = {
  teacherId: string;
  displayName: string;
  role: WorkspaceRole;
  joinedAt: string;
};

export type WorkspaceInvite = {
  id: string;
  createdAt: string;
  expiresAt: string;
  useCount: number;
  createdByName: string;
};

export type WorkspaceDetails = {
  id: string;
  name: string;
  role: WorkspaceRole;
  ownerId: string;
  createdAt: string;
  members: WorkspaceMember[];
  /** Active invite links; only returned to the owner. */
  invites: WorkspaceInvite[];
};

export type CreatedInvite = { id: string; token: string; expiresAt: string };

export type InvitePreview = {
  workspaceId: string;
  workspaceName: string;
  invitedBy: string;
  ownerName: string;
  memberCount: number;
  expiresAt: string;
  alreadyMember: boolean;
};

export type GrantSetting = { access: QuizAccess; canPublish: boolean };

export type MemberGrant = GrantSetting & { teacherId: string };

/** The sharing of one quiz inside one workspace. */
export type WorkspaceSharing = {
  workspaceId: string;
  workspaceName: string;
  /** Other members of the workspace (excludes the quiz owner). */
  members: { teacherId: string; displayName: string; role: WorkspaceRole }[];
  /** null = not open to everyone. */
  everyone: GrantSetting | null;
  grants: MemberGrant[];
};

export type QuizPermissions = {
  role: QuizRole;
  canPublish: boolean;
  canArchive: boolean;
  ownerName: string;
  revision: number;
  updatedByName: string | null;
  updatedAt: string;
};

export type SharedQuiz = {
  id: string;
  title: string;
  description: string;
  subject: string;
  coverImagePath: string | null;
  status: 'draft' | 'published' | 'archived';
  questionCount: number;
  updatedAt: string;
  ownerName: string;
  access: QuizAccess;
  canPublish: boolean;
  workspaces: string[];
};

export type QuizActivityAction = 'edited' | 'published' | 'unpublished' | 'archived' | 'restored' | 'copied';

export type QuizActivityEntry = {
  action: QuizActivityAction;
  actorName: string;
  isMe: boolean;
  createdAt: string;
};
