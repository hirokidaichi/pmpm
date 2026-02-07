export type Permission = "manage" | "write" | "read" | "none";

export type AppEnv = {
  Variables: {
    requestId: string;
    user: { id: string; email: string; name?: string } | null;
    membership: { userId: string; role: "ADMIN" | "MEMBER" | "STAKEHOLDER"; status: string } | null;
    workspaceRole: "ADMIN" | "MEMBER" | "VIEWER" | null;
    projectRole: "LEAD" | "MEMBER" | "REVIEWER" | "STAKEHOLDER" | null;
    effectivePermission: Permission;
  };
};
