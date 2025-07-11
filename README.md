# backend

Infoverse Backend Development

## Project Structure

```
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
```

## Getting Started

1. **Clone the repository:**

   ```
   git clone <repository-url>
   cd backend
   ```

2. **Install dependencies:**

   ```
   npm install
   ```

3. **Run the application:**

   - **Development mode (auto-reloads on changes):**
     ```
     npm run nodemon
     ```
   - **Development mode (manual restart required):**
     ```
     npm run dev
     ```
   - **Production build:**
     ```
     npm run build
     npm start
     ```

## Usage

Once the server is running, you can access it at `http://localhost:5000` or `:3000`.

## Committing Changes

This project uses `commitizen` for standardized commit messages. To commit your changes, run the following command and follow the prompts:

```
npm run commit
```
