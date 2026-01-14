import sharp from "sharp";
import path from "path";
import fs from "fs";

const assetsDir = path.join(process.cwd(), "src/assets");

interface CompressionResult {
  file: string;
  originalSize: number;
  newSize: number;
  savings: string;
}

async function compressImage(
  inputPath: string,
  outputPath: string,
  options: { quality?: number; maxWidth?: number } = {}
): Promise<CompressionResult> {
  const { quality = 80, maxWidth = 1200 } = options;
  const originalStats = fs.statSync(inputPath);
  const originalSize = originalStats.size;

  let pipeline = sharp(inputPath);

  // Get metadata to check dimensions
  const metadata = await pipeline.metadata();

  // Resize if wider than maxWidth
  if (metadata.width && metadata.width > maxWidth) {
    pipeline = pipeline.resize(maxWidth, undefined, {
      withoutEnlargement: true,
    });
  }

  // Compress based on format
  if (inputPath.endsWith(".png")) {
    pipeline = pipeline.png({ quality, compressionLevel: 9 });
  } else if (inputPath.endsWith(".jpg") || inputPath.endsWith(".jpeg")) {
    pipeline = pipeline.jpeg({ quality, mozjpeg: true });
  }

  await pipeline.toFile(outputPath);

  const newStats = fs.statSync(outputPath);
  const newSize = newStats.size;
  const savings = (((originalSize - newSize) / originalSize) * 100).toFixed(1);

  return {
    file: path.basename(inputPath),
    originalSize,
    newSize,
    savings: `${savings}%`,
  };
}

async function main() {
  console.log("Starting image compression...\n");

  const imagesToCompress = [
    {
      input: "support usecase.png",
      output: "support-usecase-optimized.png",
      options: { quality: 75, maxWidth: 800 },
    },
    {
      input: "logo-lrg.png",
      output: "logo-lrg-optimized.png",
      options: { quality: 80, maxWidth: 600 },
    },
    {
      input: "logo.png",
      output: "logo-optimized.png",
      options: { quality: 85, maxWidth: 300 },
    },
    {
      input: "use-case.png",
      output: "use-case-optimized.png",
      options: { quality: 80, maxWidth: 800 },
    },
    {
      input: "workflow-min.png",
      output: "workflow-min-optimized.png",
      options: { quality: 80, maxWidth: 800 },
    },
  ];

  const results: CompressionResult[] = [];

  for (const { input, output, options } of imagesToCompress) {
    const inputPath = path.join(assetsDir, input);
    const outputPath = path.join(assetsDir, output);

    if (!fs.existsSync(inputPath)) {
      console.log(`Skipping ${input} - file not found`);
      continue;
    }

    try {
      const result = await compressImage(inputPath, outputPath, options);
      results.push(result);
      console.log(
        `${result.file}: ${(result.originalSize / 1024 / 1024).toFixed(2)}MB → ${(result.newSize / 1024 / 1024).toFixed(2)}MB (${result.savings} reduction)`
      );
    } catch (error) {
      console.error(`Error compressing ${input}:`, error);
    }
  }

  console.log("\n--- Summary ---");
  const totalOriginal = results.reduce((sum, r) => sum + r.originalSize, 0);
  const totalNew = results.reduce((sum, r) => sum + r.newSize, 0);
  console.log(`Total original: ${(totalOriginal / 1024 / 1024).toFixed(2)}MB`);
  console.log(`Total compressed: ${(totalNew / 1024 / 1024).toFixed(2)}MB`);
  console.log(
    `Total savings: ${(((totalOriginal - totalNew) / totalOriginal) * 100).toFixed(1)}%`
  );

  console.log("\n--- Next Steps ---");
  console.log("1. Review the optimized images to ensure quality is acceptable");
  console.log("2. Replace original files with optimized versions:");
  for (const { input, output } of imagesToCompress) {
    if (fs.existsSync(path.join(assetsDir, output))) {
      console.log(`   mv "${output}" "${input}"`);
    }
  }
}

main().catch(console.error);
