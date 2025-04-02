# Buddha Boxing

A web-based audio effects application that allows users to mix audio loops with various effects in a collaborative environment.

## Features

- Drag and drop audio loops onto the mixing table
- Apply audio effects to each loop
- Adjust volume and wet/dry mix for each effect
- Multi-user collaboration through shared sessions
- Real-time synchronization between users

## Getting Started

### Prerequisites

- Node.js 14.x or higher

### Installation

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Start the server:
   ```
   npm start
   ```
4. Open your browser at http://localhost:3000

## Deployment

This application can be deployed on platforms that support Node.js applications, such as:

- Heroku
- Render
- Railway
- Fly.io

Make sure to set the environment variable `PORT` if your platform requires a specific port.

## Audio Files

The application looks for audio loop files in the `public/loops` directory, named from `01.m4a` to `09.m4a`. Replace these with your own audio files to customize the experience.

## License

This project is licensed under the MIT License. 