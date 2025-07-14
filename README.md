# Backend

## InfoVerse Backend Development

<details>
<summary>📁 Project Structure</summary>

```bash
express-server-template
├── src
│   ├── app.ts            # Entry point of the application
│   ├── routes            # Contains route definitions
│   │   └── index.ts      # Main routes file
│   ├── controllers       # Contains request handlers
│   │   └── index.ts      # Main controller file
│   └── middleware        # Contains middleware functions
│       └── logger.ts     # Logger middleware
├── .env.example          # env placeholders
├── package.json          # NPM configuration file
├── tsconfig.json         # TypeScript configuration
└── README.md             # Project documentation
````

</details>

---

<details>
<summary>🚀 Getting Started</summary>

### 1. Clone the repository

```bash
git clone <repository-url>
cd backend
```

---

### 2. Install dependencies

```bash
npm install
```

---

### 3. Run the application

* **Development mode (auto-reloads on changes):**

  ```bash
  npm run nodemon
  ```

* **Development mode (manual restart required):**

  ```bash
  npm run dev
  ```

* **Production build:**

  ```bash
  npm run build
  npm start
  ```

</details>

---

<details>
<summary>🌐 Usage</summary>

Once the server is running, access it at:

* `http://localhost:5000`
* or `http://localhost:3000` (depending on your `.env` config)

</details>

---

<details>
<summary>✅ Committing Changes</summary>

This project uses [**Commitizen**](https://github.com/commitizen/cz-cli) to standardize commit messages.

To commit your changes:

```bash
npm run commit
```

Follow the interactive prompts to format your message correctly.

</details>

---

<details>
<summary>🔐 Environment Setup with Dotenv Vault (click to expand)</summary>

<br>

We use [Dotenv Vault](https://dotenv.org/) to securely manage and share environment variables across the team.

---

### 1. Install the Dotenv CLI

Install globally (recommended):

```bash
npm install -g dotenv-vault
```

Or install as a dev dependency:

```bash
npm install --save-dev dotenv-vault
```

---

### 2. Login to Dotenv Vault

```bash
dotenv-vault login
```

---

### 3. Get Access to the Vault

You must be invited by the project maintainer. Ask them to run:

```bash
dotenv-vault share your-email@example.com
```

Then you should have access to the vault Id.Then run:

```bash
 npx dotenv-vault@latest new vlt_<vaultId>
```

---



### 4. Pull the Environment Variables

```bash
dotenv-vault pull
```

This will fetch and decrypt secrets into a local `.env` file.

---

### ⚠️ Do Not Push `.env`

Make sure `.env` is in `.gitignore`. It should **never** be committed:

```bash
# .gitignore
.env
```
</details>

---

<details>
<summary>🧹 Code Linting</summary>

<br>

We use **ESLint** with the **Airbnb + Prettier** configuration to maintain consistent code quality and style across the project.

---

### 🔧 Run Lint Check

Check your TypeScript files for linting issues:

```bash
npx eslint . --ext .ts
````

---

### 🛠 Auto-fix Lint Issues

Automatically fix fixable lint problems:

```bash
npx eslint . --ext .ts --fix
```

---

### 📦 Optional: Add Scripts to `package.json`

To simplify the process, you can add these scripts:

```json
"scripts": {
  "lint": "eslint . --ext .ts",
  "lint:fix": "eslint . --ext .ts --fix"
}
```

Then you can run:

```bash
npm run lint
npm run lint:fix
```

---

### 💡 VS Code Tip

Set up VS Code to auto-format and lint on save:

1. Install extensions:

   * [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
   * [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

2. In `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll": true,
    "source.fixAll.eslint": true
  },
  "eslint.validate": ["javascript", "typescript"]
}
```

---

</details>
