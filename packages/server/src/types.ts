export type AppEnv = {
  Variables: {
    requestId: string;
    user: { id: string; email: string; name?: string } | null;
    membership: { userId: string; role: "ADMIN" | "MEMBER" | "STAKEHOLDER"; status: string } | null;
  };
};
