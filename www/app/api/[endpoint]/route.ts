export const config = {
  api: {
    // Set timeout to 5 minutes (300 seconds)
    bodyParser: {
      sizeLimit: '1mb',
    },
    responseLimit: false,
  },
  // Add this to extend the timeout
  maxDuration: 300,
} 