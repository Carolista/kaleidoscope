<div align="center">
  <h1>🚀 Asteroids: A Modern Python Game</h1>
    <a href="http://www.codewithcarrie.com"><img src="https://img.shields.io/badge/by-CodeWithCarrie.com-437E1C?style=for-the-badge" alt="badge linking to CodeWithCarrie's website" /></a>
    <a href="https://www.boot.dev"><img src="https://img.shields.io/badge/for-Boot.dev-5C93CE?style=for-the-badge" alt="badge linking to Boot.dev's website" /></a>
</div>

<br />

<div align="center">
  <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/Pygame-00AA00?style=for-the-badge&logo=python&logoColor=white" alt="Pygame" />
  <img src="https://img.shields.io/badge/UV-3B82F6?style=for-the-badge" alt="UV Package Manager" />
  <img src="https://img.shields.io/badge/Ruff-FCC21B?style=for-the-badge" alt="Ruff Linter" />
</div>

---

<div align="center">
    <a href="#about">About</a> •
    <a href="#features">Features</a> •
    <a href="#visuals">Visuals</a> •
    <a href="#architecture">Architecture</a> •
    <a href="#tech">Tech Stack</a> •
    <a href="#installation">Installation</a> •
    <a href="#ai-collaboration">AI Collaboration</a> •
    <a href="#future">Future Enhancements</a>
</div>

---

<a name="about"></a>

## 💡 About the Project

This is a **modern Python implementation** of the classic Asteroids arcade game, built as a portfolio project demonstrating clean architecture, object-oriented programming principles, and polished game development. Originally created as part of [Boot.dev's](https://www.boot.dev) curriculum, this version has been significantly enhanced with professional-grade features including sophisticated collision detection, smooth visual transitions, persistent high score tracking, and a well-organized codebase.

The project showcases:

- **Clean Architecture**: Modular design with clear separation of concerns
- **Advanced OOP**: Proper inheritance hierarchies, polymorphism, and composition
- **Game Polish**: Fade transitions, particle effects, color cycling, and responsive controls
- **Professional Practices**: Type hints, comprehensive documentation, and logical code organization

---

<a name="features"></a>

## 🎮 Features

### Core Gameplay

- **Classic Mechanics**: Navigate your ship through space, destroying asteroids to progress through waves
- **Progressive Difficulty**: Each wave spawns more asteroids with increasing challenge
- **Scoring System**: Real-time score display with gradient color effects
- **High Score Tracking**: Top 5 high scores persist between sessions with player names

### Visual Polish

- **Smooth Transitions**: Context-aware fade effects
  - Full-screen fades between major game states
  - Text-only fades for wave transitions (stars remain visible)
  - Animated name entry to high scores display
- **Dynamic Starfield**: Twinkling stars that move continuously through space
- **Color Cycling**: Rainbow gradient effects on titles and UI elements
- **Particle Effects**: Visual feedback on asteroid destruction
- **Screen Shake**: Impact feedback on collisions

### Player Experience

- **Intuitive Controls**: Arrow keys for rotation, spacebar for thrust, and shooting
- **Name Entry System**: Interactive interface for recording high scores with visual placeholder
- **Replay Option**: Seamless transition from game over to new game
- **Startup Sequence**: Animated terminal-style boot sequence with system checks

### Technical Features

- **Triangle-Circle Collision**: Mathematically accurate collision detection using barycentric coordinates
- **Precise Hitboxes**: Player hitbox matches visual triangle shape (not approximated as circle)
- **Continuous Motion**: Asteroids and stars continue moving during text fade transitions
- **Event Logging**: Optional JSON-based logging for game state and events

---

<a name="visuals"></a>

### Visuals

![Console Art on Game Start](assets/images/console-art.png)
![Start Screen](assets/images/landing-screen.png)
![Gameplay](assets/images/play.png)
![High Score Name Entry](assets/images/high-score.png)
![Game Over Screen](assets/images/game-over.png)

---

<a name="architecture"></a>

## 🏗️ Architecture & Code Organization

The project follows a **modular, object-oriented architecture** with clear separation of concerns:

```
src/
├── config/              # Game configuration and constants
│   ├── constants.py     # All game constants (colors, speeds, dimensions)
│   └── funcs.py         # Utility functions
│
└── game/
    ├── entities/        # Game objects (sprites)
    │   ├── asteroid.py       # Asteroid with splitting logic
    │   ├── asteroidfield.py  # Spawning system
    │   ├── particle.py       # Particle effects
    │   ├── player.py         # Player ship with triangle hitbox
    │   ├── shot.py           # Projectile system
    │   ├── star.py           # Individual twinkling stars
    │   └── starfield.py      # Background star generation
    │
    ├── shapes/          # Collision detection geometry
    │   ├── shape.py          # Base class for all game objects
    │   ├── circleshape.py    # Circle collision logic
    │   └── triangleshape.py  # Triangle collision with barycentric coords
    │
    ├── screens/         # UI screens and components
    │   ├── screen.py         # Abstract base screen class
    │   ├── section.py        # Reusable text rendering component
    │   ├── splash.py         # Splash screen with high scores
    │   └── gameover.py       # Game over with name entry
    │
    ├── effects/         # Visual effects
    │   └── fade.py           # Multiple fade transition methods
    │
    ├── systems/         # Support systems
    │   ├── highscores.py     # JSON-based persistence
    │   ├── logger.py         # Event and state logging
    │   └── startup.py        # Terminal-style boot sequence
    │
    └── main.py          # Game loop and orchestration
```

### Design Patterns

**Inheritance Hierarchy**:

```
Shape (base)
├── CircleShape (radius-based collision)
│   ├── Asteroid
│   ├── Shot
│   ├── Particle
│   └── Star
└── TriangleShape (polygon-based collision)
    └── Player
```

**Screen System**:

```
Screen (abstract base)
├── SplashScreen (title and high scores)
└── GameOverScreen (name entry and replay)
    └── Section (reusable text component)
```

**Key Principles Demonstrated**:

- **Single Responsibility**: Each class has one clear purpose
- **Open/Closed**: Extensible through inheritance without modification
- **Liskov Substitution**: All shapes and screens properly override parent methods
- **DRY (Don't Repeat Yourself)**: Section class eliminates UI duplication
- **Composition over Inheritance**: Screens compose Section objects

---

<a name="tech"></a>

## 🛠️ Tech Stack

|                                                                                                  Technology | Description                                                  |
| ----------------------------------------------------------------------------------------------------------: | :----------------------------------------------------------- |
| ![Python](https://img.shields.io/badge/Python_3.13+-3776AB?style=for-the-badge&logo=python&logoColor=white) | Modern Python with type hints and latest features            |
| ![Pygame](https://img.shields.io/badge/Pygame_2.6.1-00AA00?style=for-the-badge&logo=python&logoColor=white) | Game development framework for sprites, rendering, and input |
|                                           ![UV](https://img.shields.io/badge/UV-3B82F6?style=for-the-badge) | Fast, modern Python package manager and task runner          |
|                                       ![Ruff](https://img.shields.io/badge/Ruff-FCC21B?style=for-the-badge) | Lightning-fast Python linter and formatter                   |

### Key Dependencies

- **Pygame 2.6.1**: Core game engine for graphics, sprites, and event handling
- **Python 3.13+**: Leverages modern Python features including enhanced type system
- **UV Package Manager**: Rapid dependency management and virtual environment handling
- **Ruff**: Code quality enforcement with 100-character line limit

---

<a name="installation"></a>

## 🚀 Installation & Setup

### Prerequisites

- Python 3.13 or higher
- UV package manager ([installation guide](https://docs.astral.sh/uv/getting-started/installation/))

### Setup Instructions

1. **Clone the repository**:

   ```bash
   git clone https://github.com/YourUsername/asteroids
   cd asteroids
   ```

2. **Install dependencies** (UV will automatically create a virtual environment):

   ```bash
   uv sync
   ```

3. **Run the game**:
   ```bash
   uv run main.py
   ```

### Controls

- **Arrow Keys**: Rotate left/right, thrust forward
- **Spacebar**: Shoot
- **Enter**: Confirm selections (splash screen, name entry, replay)
- **Backspace**: Edit name during high score entry
- **Y/N**: Replay choice on game over

### Configuration

Game constants can be adjusted in `src/config/constants.py`:

- Player speed, rotation rate, and shoot cooldown
- Asteroid sizes, speeds, and spawn rates
- Screen dimensions and colors
- Logging preferences (game state and events)

---

<a name="ai-collaboration"></a>

## 🤖 Working with AI: A Balanced Approach

This project demonstrates how AI can be an effective **development accelerator and learning tool** while highlighting the continued importance of human judgment in software architecture.

### How AI Enhanced Development

**Rapid Implementation**:

- Generated boilerplate code for game entities and systems
- Implemented complex algorithms (triangle-circle collision using barycentric coordinates)
- Created comprehensive fade transition system with multiple context-aware methods
- Automated import updates during large-scale refactoring (directory reorganization)

**Problem-Solving Assistance**:

- Debugged subtle issues like nested loop break statements preventing high score display
- Identified and fixed "warp speed" artifact during fade transitions (caused by updating positions while fading)
- Resolved import path issues after moving files to new directory structure

**Learning Accelerator**:

- Explained mathematical concepts (barycentric coordinates for point-in-triangle testing)
- Provided detailed rationale for architectural decisions
- Demonstrated Python-specific patterns and best practices

### Human Oversight and Improvements

While AI proved invaluable for implementation speed, **human intervention was critical** for maintaining code quality and architectural integrity:

**Architectural Decisions**:

- Recognized when AI's "optimizations" violated the Liskov Substitution Principle by changing method signatures in child classes
- Identified code bloat from successive refactoring iterations and initiated cleanup
- Designed the logical directory structure organizing code by responsibility (entities, shapes, screens, effects, systems)

**Pattern Recognition**:

- Caught AI storing parameters unnecessarily in `__init__` when they could be passed to methods
- Noticed inconsistencies between SplashScreen and GameOverScreen parameter handling
- Recognized that the Section class pattern could eliminate code duplication across screens

**OOP Principles**:

- Understood that Python's flexible method signatures shouldn't violate inheritance contracts, even though technically allowed
- Saw the opportunity to create a Shape base class hierarchy before AI suggested it
- Ensured proper separation of concerns (collision logic in shape classes, rendering in entity classes)

**Systemic Thinking**:

- After multiple AI-driven refactors, recognized the need to audit for unused methods (`fade_out_screen`, `fade_in_screen`)
- Understood that different types of fades (full-screen vs. text-only) required separate methods, not overloaded behavior
- Anticipated that moving files would require coordinated import updates across multiple layers

### Key Takeaway

**AI excels at**:

- Writing repetitive code quickly
- Implementing well-defined algorithms
- Searching for and fixing specific bugs
- Explaining technical concepts

**Humans remain essential for**:

- High-level architectural vision
- Recognizing when "optimizations" create technical debt
- Maintaining consistency across a growing codebase
- Applying design principles and patterns holistically

The most effective approach combines AI's speed with human judgment, using AI as a powerful tool while maintaining human oversight of system design and code quality.

---

<a name="future"></a>

## 🔮 Future Enhancements

Several features have been identified for potential future development:

### Gameplay Enhancements

- **Lives System**: Three lives with respawn mechanics and 1-up power-ups
- **Power-ups**: Shield, invincibility, rapid fire, and bombs
- **Scoring Sophistication**: Streak bonuses with visual feedback, distance multipliers

### Advanced Features

- **Sound Effects**: Engine thrust, shooting, explosions, and ambient music
- **Difficulty Modes**: Easy, Normal, Hard with different spawn rates and speeds

### Technical Improvements

- **Performance Optimization**: Spatial partitioning for collision detection
- **Configurable Controls**: Key remapping through settings menu
- **Test Suite**: Comprehensive unit tests for collision detection and game logic
- **Asset Management**: Proper resource loading system for future sprite graphics

---

## 👨‍💻 Designer & Developer

Caroline Jones - [@Carolista](https://github.com/Carolista) - [CodeWithCarrie.com](http://codewithcarrie.com) - [LinkedIn](https://www.linkedin.com/in/carolinerjones)

---

## 📝 License

This project is created for educational and portfolio purposes.
