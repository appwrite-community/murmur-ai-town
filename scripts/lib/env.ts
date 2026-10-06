function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name} in .env (see .env.example).`);
  return value;
}

export const env = {
  endpoint: required('APPWRITE_ENDPOINT'),
  projectId: required('APPWRITE_PROJECT_ID'),
  apiKey: required('APPWRITE_API_KEY'),
};
