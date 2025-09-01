# InfoVerse Backend

This is the backend for InfoVerse's Learning Management System. It is a Node.js application written in TypeScript, using Express.js as the web framework.

## Features

*   **User Authentication:** JWT-based authentication with roles (student, instructor, admin).
*   **Course Management:** Create, read, update, and delete courses.
*   **Enrollment System:** Users can enroll in courses.
*   **Review System:** Users can leave reviews and ratings for courses.
*   **Admin Panel:** Admins can manage users and courses.

## Project Structure

<details>
<summary> Project Structure</summary>

```bash
.
├── src
│   ├── app.ts            # Application entry point
│   ├── server.ts         # Server setup
│   ├── config            # Configuration files
│   ├── controllers       # Request handlers
│   ├── middleware        # Express middleware
│   ├── models            # Mongoose data models
│   ├── routes            # API route definitions
│   ├── tests             # Test files
│   └── utils             # Utility functions
├── .env.example          # Environment variable placeholders
├── package.json          # NPM configuration
├── tsconfig.json         # TypeScript configuration
└── README.md             # Project documentation
```

</details>

## API Documentation

The API is versioned with a base path of `/api/v1`.

<details>
<summary>Authentication Endpoints (`/auth`)</summary>

*   **`POST /register`**: Register a new user.
    *   **Request Body:** `{ "name": "John Doe", "email": "john@example.com", "password": "password123" }`
    *   **Response:** `{ "message": "User registered successfully" }`
*   **`POST /login`**: Login a user.
    *   **Request Body:** `{ "email": "john@example.com", "password": "password123" }`
    *   **Response:** `{ "token": "JWT_TOKEN" }`

</details>

<details>
<summary>Course Endpoints (`/courses`)</summary>

*   **`GET /`**: Get a paginated list of courses.
*   **`GET /{id}`**: Get a course by ID.
*   **`POST /`**: Create a new course (requires instructor role).
*   **`PUT /{id}`**: Update a course (requires instructor role).
*   **`DELETE /{id}`**: Delete a course (requires instructor role).

</details>

<details>
<summary>Review Endpoints (`/courses/{courseId}/reviews`)</summary>

*   **`GET /`**: Get all reviews for a course.
*   **`POST /`**: Post a review for a course (requires student role).

</details>

<details>
<summary>Enrollment Endpoints (`/courses`)</summary>

*   **`POST /{courseId}/enroll`**: Enroll in a course.
*   **`GET /{courseId}/enrollments`**: Get all enrollments for a course (requires instructor role).
*   **`PUT /enrollments/{enrollmentId}`**: Update enrollment status (requires instructor role).
*   **`DELETE /{courseId}/drop`**: Drop a course.

</details>

<details>
<summary>User Endpoints (`/users`)</summary>

*   **`GET /me/profile`**: Get the current user's profile.
*   **`PUT /me/profile`**: Update the current user's profile.
*   **`GET /me/enrollments`**: Get all courses the user is enrolled in.
*   **`GET /me/reviews`**: Get the current user's reviews.

</details>

<details>
<summary>Admin Endpoints (`/admin`)</summary>

*   **`GET /users`**: Get all users.
*   **`GET /users/{id}`**: Get a user by ID.
*   **`PUT /users`**: Create a new user.
*   **`DELETE /users/{id}`**: Delete a user.
*   **`GET /courses`**: Get all courses.
*   **`GET /courses/{id}`**: Get a course by ID.
*   **`POST /courses`**: Create a new course.
*   **`DELETE /courses/{id}`**: Delete a course.

</details>

## Data Models

<details>
<summary>Data Models</summary>

*   **User:**
    *   `name` (String)
    *   `email` (String, unique)
    *   `passwordHash` (String)
    *   `role` (String, enum: `student`, `instructor`, `admin`)
*   **Course:**
    *   `title` (String)
    *   `description` (String)
    *   `instructorId` (ObjectId, ref: `User`)
    *   `thumbnailUrl` (String)
    *   `price` (Number)
    *   `syllabus` (Array of objects)
*   **Enrollment:**
    *   `userId` (ObjectId, ref: `User`)
    *   `courseId` (ObjectId, ref: `Course`)
    *   `enrolledAt` (Date)
    *   `status` (String, enum: `active`, `completed`, `dropped`)
*   **Review:**
    *   `userId` (ObjectId, ref: `User`)
    *   `courseId` (ObjectId, ref: `Course`)
    *   `rating` (Number)
    *   `comment` (String)

</details>

## Getting Started

<details>
<summary>Getting Started</summary>

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd backend
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Set up environment variables:**
    Create a `.env` file in the root of the project and add the following variables:
    ```
    PORT=5000
    MONGO_URI=<your_mongodb_uri>
    JWT_SECRET=<your_jwt_secret>
    FRONTEND_URL=<your_frontend_url>
    REDIS_URL=<your_redis_url>
    ```
4.  **Run the application:**
    *   **Development mode (auto-reloads on changes):**
        ```bash
        npm run nodemon
        ```
    *   **Development mode (manual restart required):**
        ```bash
        npm run dev
        ```
    *   **Production build:**
        ```bash
        npm run build
        npm start
        ```

</details>

## Usage

<details>
<summary>Usage</summary>

Once the server is running, access it at:

* `http://localhost:5000`
* or `http://localhost:3000` (depending on your `.env` config)

</details>

## Committing Changes

<details>
<summary>Committing Changes</summary>

This project uses [**Commitizen**](https://github.com/commitizen/cz-cli) to standardize commit messages.

To commit your changes:

```bash
npm run commit
```

Follow the interactive prompts to format your message correctly.

</details>

## Environment Setup with Dotenv Vault

<details>
<summary>Environment Setup with Dotenv Vault</summary>


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

## Code Linting

<details>
<summary>Code Linting</summary>


We use **ESLint** with the **Airbnb + Prettier** configuration to maintain consistent code quality and style across the project.

---

###  Run Lint Check

Check your TypeScript files for linting issues:

```bash
npx eslint . --ext .ts
````

---

###  Auto-fix Lint Issues

Automatically fix fixable lint problems:

```bash
npx eslint . --ext .ts --fix
```

---

###  Optional: Add Scripts to `package.json`

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

###  VS Code Tip

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

</details>
