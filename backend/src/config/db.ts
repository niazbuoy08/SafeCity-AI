import dns from "dns";
import mongoose from "mongoose";
import { env } from "./env";

// Some ISP/local DNS resolvers refuse to look up mongodb.net's SRV/TXT
// records entirely (seen with certain Bangladeshi ISP resolvers), which
// breaks mongodb+srv:// connection strings even though the credentials and
// cluster are fine. Prepending public resolvers fixes SRV lookups without
// requiring any system-wide DNS changes on the host machine.
if (env.mongoUri.startsWith("mongodb+srv://")) {
  dns.setServers(["8.8.8.8", "1.1.1.1", ...dns.getServers()]);
}

function redactUri(uri: string): string {
  return uri.replace(/\/\/([^:]+):([^@]+)@/, "//$1:****@");
}

export async function connectDB(): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.mongoUri);
  console.log(`[db] connected to MongoDB at ${redactUri(env.mongoUri)}`);
}
