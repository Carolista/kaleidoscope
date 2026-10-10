<img src="preview/mag-logo.png" alt="Midtown Art Gallery logo" width="100%" />
<img src="preview/mag-lobby.png" alt="Image of Midtown Art Gallery lobby" width="100%" />

<div align="center">
  <h1>Midtown Art Gallery: Full-Stack Web Application</h1>
    <a href="http://www.codewithcarrie.com"><img src="https://img.shields.io/badge/by-CodeWithCarrie.com-437E1C?style=for-the-badge" alt="badge linking to CodeWithCarrie's website" /></a>
    <a href="https://www.launchcode.org"><img src="https://img.shields.io/badge/for-LaunchCode_St._Louis-5C93CE?style=for-the-badge" alt="badge linking to LaunchCode's website" /></a>
</div>

<br />

<div align="center">
  <img src="https://img.shields.io/badge/React-61DBFB?style=for-the-badge&logo=react&logoColor=333333" alt="React" />
  <img src="https://img.shields.io/badge/JavaScript-F0DB4F?style=for-the-badge&logo=javascript&logoColor=333333" alt="JavaScript" />
  <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/React_Router-CA4245?style=for-the-badge&logo=reactrouter&logoColor=white" alt="React Router" />
  <img src="https://img.shields.io/badge/Axios-5A29E4?style=for-the-badge&logo=vite&logoColor=white" alt="Axios" />
</div>

<div align="center">
  <img src="https://img.shields.io/badge/CSS-rebeccapurple?style=for-the-badge&logo=css&logoColor=white" alt="CSS" />
  <img src="https://img.shields.io/badge/FontAwesome-0A6EB4?style=for-the-badge&logo=fontawesome&logoColor=white" alt="FontAwesome" />
  <img src="https://img.shields.io/badge/Google_Fonts-EA4335?style=for-the-badge&logo=googlefonts&logoColor=white" alt="Google Fonts" />
  <img src="https://img.shields.io/badge/ESLint-4B32C3?style=for-the-badge&logo=eslint&logoColor=white" alt="ESLint" />
  <img src="https://img.shields.io/badge/Prettier-F7B93E?style=for-the-badge&logo=prettier&logoColor=333333" alt="Prettier" />
</div>

<div align="center">
  <img src="https://img.shields.io/badge/Spring_Boot-6DB33F?style=for-the-badge&logo=springboot&logoColor=white" alt="Spring Boot" />
  <img src="https://img.shields.io/badge/Maven-C71A36?style=for-the-badge&logo=apachemaven&logoColor=white" alt="Maven" />
  <img src="https://img.shields.io/badge/Java-ED8B00?style=for-the-badge" alt="Java" />
  <img src="https://img.shields.io/badge/MySQL-00758F?style=for-the-badge" alt="MySQL" />
  <img src="https://img.shields.io/badge/Hibernate-59666C?style=for-the-badge&logo=hibernate&logoColor=white" alt="Hibernate" />
  <img src="https://img.shields.io/badge/Spring_Security-6DB33F?style=for-the-badge&logo=springsecurity&logoColor=white" alt="Spring Security" />
</div>

---

<div align="center">
    <a href="#about">About</a> •
    <a href="#features">Features</a> •
    <a href="#visuals">Key Visuals</a> •
    <a href="#tech">Tech Stack</a> •
    <a href="#installation">Installation</a> •
    <a href="#database">Database</a> •
    <a href="#api">API</a> •
    <a href="#future">Future Features</a>
</div>

---

<a name="about"></a>
## 💡 About the Project

This is a **full-stack project** that I designed originally as a teaching tool for my students at [LaunchCode](http://www.launchcode.org). As a web application, it has two primary uses: as a publicly accessible site for the fictitious Midtown Art Gallery and as a secure administrative portal for data management. The application provides a responsive, accessible interface built with modern ReactJS components, while all data persistence and security are handled by a robust Java Spring Boot backend and a MySQL relational database.

The `main` branch contains a more advanced version of the project that I am building and maintaining as part of my portfolio, while the other branches are for the use of students working through different phases of the project they watch me build during class.

> [!IMPORTANT]
> Students who are using this project as a learning tool should read the [instructions](docs/INSTRUCTIONS.md) for creating and building this project.

---

<a name="features"></a>
## 🎨 Features

### Public-Facing Site
- **Art Gallery View:** Displays all artworks currently on display
- **Dynamic Details Pages:** Each artwork links to a dynamic page showing a full-size image and details (artist, categories, description, etc.)
- **Responsive Design:** Fully functional across multiple breakpoints for desktop, tablet, and mobile devices
- **Accessibility:** UI elements adhere to basic accessibility standards (semantic HTML, image alt text, etc.)

### Admin Portal (Secure)
- **Authentication:** Secure login/logout using token-based Spring Security
- **Authorization:** Admin has access to entire website
- **CRUD Operations:** Admin can view, add, and delete database records (artworks, artists, and categories)

---

<a name="visuals"></a>
## 📸 Key Visuals

### Wireframes w/Site Map

<details>
  <summary>Click here to toggle view of wireframes.</summary><br />
  <em>Coming soon!</em>
</details>

### Preview of UI

> Click on any of the items below to expand or collapse them.

#### PUBLIC SITE

<details open>
    <summary>Home & Login Pages</summary>
    <img src="preview/public-home-page.png" alt="Screenshot of Public Home Page view" height="500px" />
    <img src="preview/login-page.png" alt="Screenshot of Login Page view" height="500px" />
</details>

<details>
    <summary>About & Location Pages</summary>
    <img src="preview/about-page.png" alt="Screenshot of About Page view" height="500px" />
    <img src="preview/location-page.png" alt="Screenshot of Location Page" height="500px" />
</details>

<details>
    <summary>Artwork Gallery & Details Pages</summary>
    <img src="preview/artwork-gallery.png" alt="Screenshot of Artwork Gallery view" width="700px" />
    <img src="preview/artwork-details.png" alt="Screenshot of Artwork Details Page view" width="700px" />
</details>

#### ADMIN PORTAL

<details>
    <summary>Admin Home</summary>
    <img src="preview/admin-home-page.png" alt="Screenshot of Admin Home Page view" height="500px" />
</details>
<details>
    <summary>Admin Tables</summary>
    <img src="preview/artworks-table.png" alt="Screenshot of Artworks Table view" height="500px" />
    <img src="preview/artists-table.png" alt="Screenshot of Artists Table view" height="500px" />
    <img src="preview/categories-table.png" alt="Screenshot of Categories Table view" height="500px" />
</details>

<details>
    <summary>Admin Forms</summary>
    <img src="preview/add-artwork-form.png" alt="Screenshot of Add Artwork Form view" width="700px" />
    <img src="preview/add-artist-form.png" alt="Screenshot of Add Artist Form view" width="700px" />
    <img src="preview/add-category-form.png" alt="Screenshot of Add Category Form view" width="700px" />
</details>

<!-- TODO: Add add'l images as UI grows -->
<!-- TODO: Replace some images with animated GIFs? -->

---

<a name="tech"></a>
## 🛠️ Tech Stack

This full-stack project leverages a modern, decoupled MVC architecture with multiple integrated dependencies.

### Front End

| Technology | Description |
|       ---: | :---        |
| ![JavaScript](https://img.shields.io/badge/JavaScript-F0DB4F?style=for-the-badge&logo=javascript&logoColor=323330) | Core programming language, native to all browsers for dynamic user experience |
| ![React](https://img.shields.io/badge/React-61DBFB?style=for-the-badge&logo=react&logoColor=20232A) | Efficient, interactive UI through component-based architecture and a virtual DOM |
| ![React Router](https://img.shields.io/badge/React_Router-CA4245?style=for-the-badge&logo=reactrouter&logoColor=white) | Declarative, component-based navigation and routing |
| ![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white) | Quick cold start and near-instantaneous Hot Module Replacement (HMR) |
| ![CSS](https://img.shields.io/badge/CSS-rebeccapurple?style=for-the-badge&logo=css&logoColor=white) | Styling, layout, responsiveness, and accessibility improvements |
| ![Google Fonts](https://img.shields.io/badge/Google_Fonts-EA4335?style=for-the-badge&logo=googlefonts&logoColor=white) | A vast library of open-source fonts, making high-quality typography easily accessible across the web |
| ![Font Awesome](https://img.shields.io/badge/Font_Awesome-0A6EB4?style=for-the-badge&logo=fontawesome&logoColor=white) | Scalable vector icons that can be customized with CSS |
| ![Prettier](https://img.shields.io/badge/Prettier-F7B93E?style=for-the-badge&logo=prettier&logoColor=333333) | Consistent, opinionated code formatting for readability and a unified codebase |
| ![ESLint](https://img.shields.io/badge/ESLint-4B32C3?style=for-the-badge&logo=eslint&logoColor=white) | Higher code quality and maintainability due to identification of potential errors & anti-patterns |

### Back End & Database
| Technology | Description |
|       ---: | :---        |
| ![Java](https://img.shields.io/badge/Java-ED8B00?style=for-the-badge) | Core programming language for robust and scalable web applications |
| ![SpringBoot](https://img.shields.io/badge/SpringBoot-6DB33F?style=for-the-badge&logo=springboot&logoColor=white) | Rapid creation of standalone application with a RESTful API |
| ![Maven](https://img.shields.io/badge/Maven-C71A36?style=for-the-badge&logo=apachemaven&logoColor=white) | Comprehensive, convention-over-configuration approach that simplifies dependency management |
| ![Hibernate](https://img.shields.io/badge/Hibernate-59666C?style=for-the-badge&logo=hibernate&logoColor=white) | Object-Relational Mapping (ORM) tool for database interactions |
| ![MySQL](https://img.shields.io/badge/MySQL-00758F?style=for-the-badge) | Relational database with structured data storage |
| ![Spring Security](https://img.shields.io/badge/Spring_Security-6DB33F?style=for-the-badge&logo=springsecurity&logoColor=white) | Out-of-the-box user authentication and authorization using JWT (JSON Web Tokens) |

---

<a name="installation"></a>
## 🚀 Prerequisites & Installation

> [!NOTE]
> To run this project locally, you will need the following installed:
> - Node.js (LTS version)
> - npm or yarn
> - Java Development Kit (JDK) 21
> - MySQL Server (version 8.0+)

---

### Back End Setup (Java/Spring Boot/MySQL)

1.  **Clone the repository:** In the terminal, navigate to the directory where you want the project to live, then execute the following commands:
    ```shell
    git clone https://github.com/Carolista/swd-unit2-java-art-gallery-project  # or your link, if forked
    cd swd-unit2-java-art-gallery-project/art-gallery-backend
    ```

1.  **Configure secrets for database and JWTs:** Create a new MySQL database named `gallery_db`, then create an `.env` file at the project root directory (`art-gallery-backend`): 
    ```properties
    # Location of your local database server
    DB_HOST=localhost
    DB_PORT=3306
    
    # Database name
    DB_NAME_PART_6=gallery_db
    
    # Credentials
    DB_USER=root
    DB_PASS=[your_password]
    
    # Auth
    JWT_SECRET=artgallery
    ```

1.  **Seed database with data:** Import [these CSV files](https://github.com/Carolista/swd-unit2-java-art-gallery-project/tree/main/test-data/part5-and-part6-data) into the database, in the following order: `artists.csv`, `categories.csv`, `details.csv`, `artworks.csv`, `artwork_categories.csv`

1.  **Run the Java/Spring Boot application:** If you do not have the application loaded in an IDE such as IntelliJ, go to the terminal and navigate to the root directory of the backend project. Then execute the following command to build and run the application (Hibernate will automatically create the tables): 
    ```shell
    mvn spring-boot:run
    ```
    
    🟢 The API should now be running on `http://localhost:8080`.

1.  **Register an admin user:** Using a tool such as Postman, make a `POST` request to `http://localhost:8080/api/user/register` with a JSON body structured as follows:
    ```json
    {
        "name": "John Smith",
        "email": "john@smith.com",
        "password": "abcd1234"
    }
    ```

> [!WARNING]
> If you get an `UnsupportedClassVersionError`, you may need to set your `JAVA_HOME` environment variable to point to a Java 21 JDK installation. If you are running the application from an IDE (like IntelliJ or VS Code), you will also need to ensure the project's SDK and language level settings within the IDE are configured to use a Java 21 JDK.

---

### Front End Setup (React/Vite)

1.  **Navigate to the front end project directory:** 
    ```shell
    cd ../art-gallery-frontend
    ```

1.  **Install dependencies:** 
    ```shell
    npm install
    # or 
    # yarn install
    ```

1.  **Run the React/Vite application:** 
    ```shell
    npm run dev
    # or
    # yarn dev
    ```
    
    🟢 The frontend application will start and can be found in a browser, typically at `http://localhost:5173`.

---

<a name="database"></a>
## 🗄️ Database Structure (ERD)

This project utilizes a MySQL database structured around four core entities, managed by Hibernate with the following relationships:

1.  **Artwork** ↔️ **Details**: One-to-One
2.  **Artwork** ↔️ **Artist**: Many-to-One
3.  **Artwork** ↔️ **Category**: Many-to-Many

### Entity Relationship Diagram (ERD)
<details open>
  <summary>Click here to toggle view of ERD</summary><br />
<em>Click on image to view in Figma.</em><br />
<a href="https://www.figma.com/board/o34g5TcvORPtVTM2M2ONtk/ERD---Art-Gallery--Spring-"><img src="preview/erd.png" alt="Entity Relationship Diagram" /></a>
</details>

---

<a name="api"></a>
## ⚙️ API Endpoints

The following RESTful endpoints manage data access and authentication. **Note:** All `POST` and `DEL` endpoints (except `register` and `login`) require a valid JWT in the Authorization header.

### Artworks 🖼️
| HTTP Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| 🟢 `GET` | `/api/artworks` | Retrieve a list of all artworks | 🌎 Public |
| 🟢 `GET` | `/api/artworks/details/:id` | Retrieve detailed record for a single artwork | 🌎 Public |
| 🟡 `POST` | `/api/artworks/add` | Create a new artwork record | 🔰 Admin |
| 🔴 `DEL` | `/api/artworks/delete/:id` | Delete an artwork by ID | 🔰 Admin |

### Artists 🎨
| HTTP Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| 🟢 `GET` | `/api/artists` | Retrieve a list of all artists | 🌎 Public |
| 🟢 `GET` | `/api/artists/details/:id` | Retrieve detailed record for a single artist | 🌎 Public |
| 🟡 `POST` | `/api/artists/add` | Create a new artist record | 🔰 Admin |
| 🔴 `DEL` | `/api/artists/delete/:id` | Delete an artist by ID | 🔰 Admin |

### Categories 🏷️
| HTTP Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| 🟢 `GET` | `/api/categories` | Retrieve a list of all categories | 🌎 Public |
| 🟢 `GET` | `/api/categories/details/:id` | Retrieve detailed record for a single category | 🌎 Public |
| 🟡 `POST` | `/api/categories/add` | Create a new category record | 🔰 Admin |

### Authentication 🔐
| HTTP Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| 🟡 `POST` | `/api/user/login` | Authenticate and receive a JWT | 🌎 Public |
| 🟡 `POST` | `/api/user/logout` | Invalidate the current session token (tracked server-side) | 🌎 Public |
| 🟡 `POST` | `/api/user/validate-token` | Check if a token is currently valid | 🌎 Public |

<!-- | 🟡 `POST` | `/api/user/register` | Register a new user (for initial setup/testing) | 🌎 Public | -->
---

<a name="future"></a>
## 🔮 Future Features

Several features have been scoped out for future development to expand the application's functionality.

### Improve Fetching
- Refactor React app to utilize `use()` in conjunction with `<Suspense />` to simplify promise handling & loading state
- Use Axios for all HTTP requests, not just auth

### Improve CRUD
- Enable Admin to delete categories
- Enable Admin to edit categories, artists, and artworks

### Gallery Events
- Implement dedicated **Events** entity and full CRUD functionality for events
- Add a public-facing `/events` route to display upcoming gallery events
- Add a registration form to UI to collect ticket reservations for an event
- Provide for event data management in the admin portal

### Advanced Search, Sort & Filtering
- Implement dynamic filtering and sorting on the public gallery page (by Category, Artist name, or Artwork title)
- Implement dynamic sorting on the public events page (by date, title, type, or host)
- Add a full-text search bar on both artworks and events pages

---

## 🧑‍💻 Designer & Author

Caroline Jones - [@Carolista](https://github.com/Carolista) - [CodeWithCarrie.com](http://codewithcarrie.com) - [LinkedIn](https://www.linkedin.com/in/carolinerjones)
