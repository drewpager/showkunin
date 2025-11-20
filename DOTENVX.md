# dotenvx Encrypted Environment Variables

This project uses [dotenvx](https://dotenvx.com/) for secure, encrypted environment variable management. dotenvx allows you to commit encrypted `.env` files to your repository while keeping decryption keys secure.

## Quick Start

### 1. Create Your `.env` File

Copy `.env.example` to `.env` and fill in your actual values:

```bash
cp .env.example .env
```

### 2. Encrypt Your `.env` File

Run the encryption command:

```bash
npm run env:encrypt
```

This will:

- Encrypt your `.env` file
- Create a `.env.keys` file containing your decryption key
- The `.env.keys` file is automatically gitignored (NEVER commit this!)

### 3. Set Your Decryption Key

For local development, you can either:

**Option A: Use the `.env.keys` file** (automatically loaded by dotenvx)

- The `.env.keys` file is created automatically when you encrypt
- Make sure it's in your `.gitignore` (already configured)

**Option B: Set `DOTENV_PRIVATE_KEY` environment variable**

```bash
export DOTENV_PRIVATE_KEY="your-private-key-from-env-keys-file"
```

### 4. Run Your Application

All npm scripts have been updated to use dotenvx automatically:

```bash
npm run dev      # Development server
npm run build    # Production build
npm run start    # Production server
npm run test:s3  # Tests
```

## Available Commands

- `npm run env:encrypt` - Encrypt your `.env` file
- `npm run env:decrypt` - Decrypt your `.env` file (for editing)
- `npm run env:keys` - View your encryption keys

## How It Works

1. **Encryption**: When you run `npm run env:encrypt`, dotenvx:

   - Reads your `.env` file
   - Encrypts sensitive values
   - Adds a `DOTENV_PUBLIC_KEY` to your `.env` file
   - Creates a `.env.keys` file with the private decryption key

2. **Runtime**: When you run commands with `dotenvx run --`, dotenvx:
   - Reads the encrypted `.env` file
   - Uses the private key (from `.env.keys` or `DOTENV_PRIVATE_KEY` env var)
   - Decrypts values and makes them available to your application
   - Works seamlessly with Next.js and all your scripts

## Deployment

### Vercel

Set the `DOTENV_PRIVATE_KEY` environment variable in your Vercel project settings:

```bash
npx vercel env add DOTENV_PRIVATE_KEY production
```

Then paste your private key from `.env.keys` when prompted.

### Other Platforms

For other platforms (AWS, Railway, Render, etc.), set the `DOTENV_PRIVATE_KEY` environment variable with the value from your `.env.keys` file.

## Security Best Practices

1. ✅ **DO** commit encrypted `.env` files to git
2. ✅ **DO** share encrypted `.env` files with your team
3. ❌ **NEVER** commit `.env.keys` file to git
4. ❌ **NEVER** share your private key publicly
5. ✅ **DO** use different keys for different environments (dev/staging/prod)
6. ✅ **DO** rotate keys periodically

## Updating Environment Variables

1. Decrypt your `.env` file:

   ```bash
   npm run env:decrypt
   ```

2. Edit the decrypted `.env` file with your changes

3. Re-encrypt:
   ```bash
   npm run env:encrypt
   ```

## Troubleshooting

### "Missing DOTENV_PRIVATE_KEY"

Make sure you have either:

- A `.env.keys` file in your project root, OR
- The `DOTENV_PRIVATE_KEY` environment variable set

### "Invalid encrypted value"

Your `.env` file might be corrupted or encrypted with a different key. Try:

1. Decrypting with your current key: `npm run env:decrypt`
2. If that fails, you may need to re-encrypt from scratch

### Environment variables not loading

Make sure you're using the npm scripts (which include `dotenvx run --`). If running commands directly, prefix them with `dotenvx run --`:

```bash
dotenvx run -- next dev
```

## Additional Resources

- [dotenvx Documentation](https://dotenvx.com/docs/)
- [dotenvx Next.js Guide](https://dotenvx.com/docs/frameworks/nextjs)
- [dotenvx Encryption Whitepaper](https://dotenvx.com/docs/whitepaper)
