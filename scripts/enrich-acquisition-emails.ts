import { prisma } from "@/lib/prisma";
import { findPublicEmail } from "@/lib/acquisition-email";

const CONCURRENCY = 5;

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const prospects = await prisma.acquisitionProspect.findMany({
    where: { source: "GOOGLE_BUSINESS", email: null, sourceDetail: { contains: "Website:" } },
    select: { id: true, businessName: true, sourceDetail: true },
    orderBy: { createdAt: "asc" },
  });
  let checked = 0;
  let found = 0;
  let updated = 0;
  for (let index = 0; index < prospects.length; index += CONCURRENCY) {
    await Promise.all(prospects.slice(index, index + CONCURRENCY).map(async (prospect) => {
      checked += 1;
      const email = await findPublicEmail(prospect.sourceDetail);
      if (!email) {
        console.log(`NO EMAIL\t${prospect.businessName}`);
        return;
      }
      found += 1;
      console.log(`${dryRun ? "WOULD UPDATE" : "UPDATE"}\t${prospect.businessName}\t${email}`);
      if (!dryRun) {
        await prisma.acquisitionProspect.update({ where: { id: prospect.id }, data: { email } });
        updated += 1;
      }
    }));
  }
  console.log(`Checked ${checked} websites; found ${found} public emails; ${dryRun ? "would update" : "updated"} ${dryRun ? found : updated} prospects.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
