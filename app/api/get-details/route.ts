import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Get the API_URL environment variable (server-side, no NEXT_PUBLIC_ prefix needed)
    // Note: Using API_URL instead of PORT because PORT is reserved by Next.js
    const apiUrl = process.env.API_URL || process.env.PORT
    
    console.log("API_URL environment variable:", apiUrl)
    console.log("PORT environment variable (Next.js default):", process.env.PORT)
    
    // Validate that API_URL is set
    if (!apiUrl || apiUrl.trim() === '') {
      return NextResponse.json(
        { error: 'API_URL environment variable is not set. Please set API_URL in your .env.local file (e.g., API_URL=http://192.168.0.121:8010/user_analytics_dashboard).' },
        { status: 500 }
      )
    }
    
    // Handle both port number and full URL
    let url = apiUrl.trim()
    
    // Check if it's just a number (port number) - this means it's likely Next.js's PORT
    const portNumber = parseInt(url, 10)
    if (!isNaN(portNumber) && url === portNumber.toString()) {
      // This is likely Next.js's PORT variable, not the API URL
      return NextResponse.json(
        { error: `PORT environment variable contains a port number (${portNumber}), which is Next.js's default. Please use API_URL instead in your .env.local file (e.g., API_URL=http://192.168.0.121:8010/user_analytics_dashboard).` },
        { status: 500 }
      )
    }
    
    // It should be a full URL, validate it
    try {
      new URL(url) // Validate URL format
    } catch {
      return NextResponse.json(
        { error: `Invalid URL in API_URL environment variable: "${url}". Please provide a full URL (e.g., http://192.168.0.121:8010/user_analytics_dashboard).` },
        { status: 500 }
      )
    }
    
    console.log("Fetching data from:", url)
    const response = await fetch(url, {
      cache: 'no-store', // Ensure fresh data on each request
    })
    
    console.log("Response status:", response.status, response.statusText)
    console.log(response)
    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`)
    }
    
    const data = await response.json()
    console.log(data.output)
    console.log("Data received successfully")
    
    // Return the data as JSON
    return NextResponse.json(data.output, { status: 200 })
  } catch (error) {
    console.error('Error fetching data from PORT:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch data' },
      { status: 500 }
    )
  }
}

