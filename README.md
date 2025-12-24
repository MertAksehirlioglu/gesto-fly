# Gesto Fly 🏀🖐️

A gesture-controlled basketball game built with **Vue 3**, **Matter.js**, and **MediaPipe**.

Play basketball using your hand gestures via webcam! Pick up the ball, aim, and throw it into the hoop. Compete for the high score on the leaderboard.

## Features

-   **Gesture Control**: Use your hand to grab (pinch) and throw the basketball.
-   **Physics Engine**: Realistic 2D physics powered by Matter.js.
-   **Throw Assist**: Smart velocity tracking and force multipliers for satisfying throws.
-   **Game Modes**:
    -   **Competitive**: 30-second timer, scores saved to leaderboard.
    -   **Practice**: Infinite time, free throw mode.
-   **Leaderboard**: Local high score tracking.
-   **Team Selector**: Choose your favorite EuroLeague team to customize the stadium colors.

## Tech Stack

-   [Vue 3](https://vuejs.org/) (Composition API)
-   [Matter.js](https://brm.io/matter-js/) (2D Physics)
-   [MediaPipe Tasks Vision](https://developers.google.com/mediapipe) (Hand Tracking)
-   [Vite](https://vitejs.dev/) (Build Tool)

## Project Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Deployment

This project is ready to be deployed on [Vercel](https://vercel.com).

1.  Push your code to a Git repository (GitHub/GitLab/Bitbucket).
2.  Import the project into Vercel.
3.  Vercel will detect `Vite` and automatically configure the build settings.
4.  Deploy!

## Controls

-   **Move Hand**: Move the cursor.
-   **Pinch (Index + Thumb)**: Grab the ball.
-   **Release Pinch**: Throw the ball.
