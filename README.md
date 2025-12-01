# Bharat Innovates - Application Review Portal

A modern web application for reviewing and commenting on innovation applications.

## Features

- 📊 **Dashboard View**: Browse all applications in a responsive grid layout
- 🔍 **Search & Filter**: Search by Application ID, Name, Venture Name, or Innovation Title
- 🎯 **Advanced Filters**: Filter by segment, TRL level, and funding status
- 📝 **Detailed View**: Comprehensive application details in a modal view
- 💬 **Commenting System**: Add review comments for each application (stored in browser localStorage)
- 📱 **Responsive Design**: Works on desktop, tablet, and mobile devices

## Files

- `index.html` - Main HTML file
- `styles.css` - Styling and layout
- `app.js` - Application logic and functionality
- `Applications_1186_final_final.json` - Application data (required)

## Quick Start

### Option 1: Simple HTTP Server (Python)

```bash
# Python 3
python3 -m http.server 8000

# Then open: http://localhost:8000
```

### Option 2: Simple HTTP Server (Node.js)

```bash
# Install http-server globally
npm install -g http-server

# Run server
http-server -p 8000

# Then open: http://localhost:8000
```

### Option 3: Use the provided server script

```bash
python3 server.py
# Then open: http://localhost:8000
```

## Deployment Options

### GitHub Pages
1. Create a new GitHub repository
2. Upload all files (index.html, styles.css, app.js, Applications_1186_final_final.json)
3. Go to Settings > Pages
4. Select main branch and save
5. Your site will be available at: `https://yourusername.github.io/repository-name`

### Netlify
1. Drag and drop the folder containing all files to Netlify
2. Your site will be live instantly

### Vercel
1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in the project directory
3. Follow the prompts

### Any Static Hosting
Upload all files to any static hosting service (AWS S3, Google Cloud Storage, etc.)

## Usage

1. **Browse Applications**: Scroll through the grid to see all applications
2. **Search**: Type in the search box to find specific applications
3. **Filter**: Use the dropdown filters to narrow down results
4. **View Details**: Click on any application card to see full details
5. **Add Comments**: Scroll to the bottom of the detail view to add review comments
6. **Comments Storage**: Comments are stored in browser localStorage (per browser)

## Notes

- Comments are stored locally in the browser (localStorage)
- For production use, you may want to implement a backend API for comments
- The JSON file must be in the same directory as index.html
- All links to external documents/videos will open in new tabs

## Customization

You can customize the application by modifying:
- `styles.css` - Change colors, fonts, layout
- `app.js` - Modify functionality, add features
- `index.html` - Adjust structure and content

## Browser Support

Works on all modern browsers:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers

