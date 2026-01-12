'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { routeToAppMap } from '../api/get-details/data'

interface AnalyticsData {
  endpoint: string
  user: string
  query_params?: Record<string, unknown>
  purpose?: string
  date?: string
  time?: string
}

type ColumnKey = 'datetime' | 'user' | 'endpoint' | 'purpose' | 'params' | 'app'

// Function to convert a Date to IST (Indian Standard Time, UTC+5:30) formatted string
const formatToIST = (date: Date): string => {
  // Use Intl.DateTimeFormat with Asia/Kolkata timezone for IST
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }
  
  const formatter = new Intl.DateTimeFormat('en-CA', options) // en-CA gives YYYY-MM-DD format
  const parts = formatter.formatToParts(date)
  
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00'
  
  const year = getPart('year')
  const month = getPart('month')
  const day = getPart('day')
  const hour = getPart('hour')
  const minute = getPart('minute')
  const second = getPart('second')
  const dayPeriod = getPart('dayPeriod') // AM or PM
  
  return `${year}-${month}-${day} ${hour}:${minute}:${second} ${dayPeriod}`
}

// Function to parse datetime string in various formats and return timestamp
const parseDateTime = (dateStr: string, timeStr?: string, fallbackDate?: string): number => {
  // If date string contains both date and time (format: "YYYY-MM-DD HH:MM:SS")
  if (dateStr && dateStr.includes(' ') && dateStr.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/)) {
    // Convert "YYYY-MM-DD HH:MM:SS" to ISO format "YYYY-MM-DDTHH:MM:SS"
    const isoFormat = dateStr.replace(' ', 'T')
    const timestamp = Date.parse(isoFormat)
    if (!Number.isNaN(timestamp)) {
      return timestamp
    }
  }

  // If date string is in ISO format (with T separator)
  if (dateStr && dateStr.includes('T')) {
    const timestamp = Date.parse(dateStr)
    if (!Number.isNaN(timestamp)) {
      return timestamp
    }
  }

  // If we have separate date and time fields
  if (dateStr && timeStr) {
    // Normalize date to YYYY-MM-DD format
    const normalizedDate = dateStr.slice(0, 10)
    // Combine date and time in ISO format
    const combined = `${normalizedDate}T${timeStr}`
    const timestamp = Date.parse(combined)
    if (!Number.isNaN(timestamp)) {
      return timestamp
    }
  }

  // If we only have date (YYYY-MM-DD)
  if (dateStr && dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
    const normalizedDate = dateStr.slice(0, 10)
    const timestamp = Date.parse(normalizedDate)
    if (!Number.isNaN(timestamp)) {
      return timestamp
    }
  }

  // If we only have time, use fallback date
  if (timeStr && fallbackDate) {
    const combined = `${fallbackDate}T${timeStr}`
    const timestamp = Date.parse(combined)
    if (!Number.isNaN(timestamp)) {
      return timestamp
    }
  }

  // If we have date but no time, use start of day
  if (dateStr && dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
    const normalizedDate = dateStr.slice(0, 10)
    const timestamp = Date.parse(`${normalizedDate}T00:00:00`)
    if (!Number.isNaN(timestamp)) {
      return timestamp
    }
  }

  return Number.NEGATIVE_INFINITY
}

const getSortTimestamp = (item: AnalyticsData, fallbackDate: string): number => {
  return parseDateTime(item.date || '', item.time, fallbackDate)
}

const DashboardPage = () => {
  const [data, setData] = useState<AnalyticsData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Date filter (temporarily disabled)
  const [dateFilter, setDateFilter] = useState<string>('')

  // Multi-select user filter state
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])

  // Unified filter menu state
  const [filterMenuOpen, setFilterMenuOpen] = useState<boolean>(false)
  const [activeFilterTab, setActiveFilterTab] = useState<'users' | null>('users')

  // Columns selector state
  const allFields: ColumnKey[] = ['datetime', 'user', 'endpoint', 'app', 'params']
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(allFields)
  const [columnsMenuOpen, setColumnsMenuOpen] = useState<boolean>(false)
  const columnsMenuRef = useRef<HTMLDivElement | null>(null)

  // Track expanded rows (by index)
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

  // Sorting state
  const [sortConfig, setSortConfig] = useState<{ key: 'datetime'; direction: 'asc' | 'desc' }>({
    key: 'datetime',
    direction: 'desc',
  })

  // Ref for click-outside behavior
  const filterMenuRef = useRef<HTMLDivElement | null>(null)

  const tempDate = useMemo(() => new Date().toISOString().slice(0, 10), [])

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/get-details', {
          headers: {
            "x-frontend-token": "methodtech-vercel-2025",
          }
        })
        if (!response.ok) {
          throw new Error(`Failed to fetch data: ${response.statusText}`)
        }
        const jsonData = await response.json()
        const dataArray: AnalyticsData[] = Array.isArray(jsonData) ? jsonData : [jsonData]
        setData(dataArray)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data')
        console.error('Error fetching data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Click-outside to close Filters
  useEffect(() => {
    if (!filterMenuOpen) return
    const onDocMouseDown = (e: MouseEvent) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) {
        setFilterMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [filterMenuOpen])

  // Click-outside to close Columns
  useEffect(() => {
    if (!columnsMenuOpen) return
    const onDocMouseDown = (e: MouseEvent) => {
      if (columnsMenuRef.current && !columnsMenuRef.current.contains(e.target as Node)) {
        setColumnsMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [columnsMenuOpen])

  const uniqueUsers = useMemo(() => {
    const users = Array.from(new Set((data || []).map(item => item.user).filter(Boolean))) as string[]
    users.sort((a, b) => a.localeCompare(b))
    return users
  }, [data])

  const filteredData = useMemo(() => {
    const filtered = (data || []).filter(item => {
      const matchesSelectedUsers = selectedUsers.length > 0 ? selectedUsers.includes(item.user) : true
      const normalizedDate = (item.date && item.date.slice(0, 10)) || tempDate
      // Date filter disabled for now
      const matchesDate = true // dateFilter ? normalizedDate === dateFilter : true
      return matchesSelectedUsers && matchesDate
    })

    const compareItems = (a: AnalyticsData, b: AnalyticsData) => {
      if (sortConfig.key === 'datetime') {
        const aValue = getSortTimestamp(a, tempDate)
        const bValue = getSortTimestamp(b, tempDate)
        
        // For DESC (descending): larger timestamps come first (latest first)
        // For ASC (ascending): smaller timestamps come first (oldest first)
        if (sortConfig.direction === 'desc') {
          // Descending: aValue > bValue means a is newer, so a should come first (return negative)
          return bValue - aValue
        } else {
          // Ascending: aValue < bValue means a is older, so a should come first (return negative)
          return aValue - bValue
        }
      }

      return 0
    }

    return filtered.slice().sort(compareItems)
  }, [data, selectedUsers, /*dateFilter,*/ tempDate, sortConfig])

  const handleSort = (column: 'datetime') => {
    setSortConfig(prev => {
      if (prev.key === column) {
        return {
          key: column,
          direction: prev.direction === 'asc' ? 'desc' : 'asc',
        }
      }
      return { key: column, direction: 'asc' }
    })
  }

  const renderSortIcon = (column: 'datetime') => {
    if (sortConfig.key !== column) {
      return <span className="text-gray-400">↕</span>
    }
    return sortConfig.direction === 'asc' ? <span>▲</span> : <span>▼</span>
  }

  // Function to format date and time together (converts to IST)
  const formatDateTime = (item: AnalyticsData): string => {
    // If date already contains full datetime in "YYYY-MM-DD HH:MM:SS" format
    // Treat it as UTC and convert to IST
    if (item.date && item.date.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/)) {
      // Convert "YYYY-MM-DD HH:MM:SS" to ISO format for parsing as UTC
      const isoFormat = item.date.replace(' ', 'T') + 'Z' // Append Z to treat as UTC
      const utcDate = new Date(isoFormat)
      if (!Number.isNaN(utcDate.getTime())) {
        return formatToIST(utcDate)
      }
      return item.date // Fallback if parsing fails
    }
    
    // If date contains ISO format with T separator
    if (item.date && item.date.includes('T')) {
      // Parse ISO format and convert to IST
      const isoDate = new Date(item.date)
      if (!Number.isNaN(isoDate.getTime())) {
        return formatToIST(isoDate)
      }
    }
    
    // Otherwise, combine separate date and time fields
    const normalizedDate = (item.date && item.date.slice(0, 10)) || tempDate
    const time = item.time || getTimeFromDate(item.date)
    
    if (time === '—') {
      return normalizedDate
    }
    
    // Combine and convert to IST
    const combinedDateTime = `${normalizedDate}T${time}Z` // Treat as UTC
    const utcDate = new Date(combinedDateTime)
    if (!Number.isNaN(utcDate.getTime())) {
      return formatToIST(utcDate)
    }
    
    return `${normalizedDate} ${time}`
  }

  // Helper to parse string that might be JSON
  const tryParseJSON = (value: unknown): unknown => {
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
        try {
          return JSON.parse(trimmed)
        } catch {
          return value
        }
      }
    }
    return value
  }

  // Count total displayable rows for a params object
  const countTotalRows = (params: Record<string, unknown>): number => {
    let count = 0
    const entries = Object.entries(params).filter(([key]) => key !== 'user')
    for (const [, value] of entries) {
      const parsed = tryParseJSON(value)
      // If it's an array of arrays, each inner array is a row
      if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(v => Array.isArray(v))) {
        count += parsed.length
      } else {
        count += 1
      }
    }
    return count
  }

  // Flatten params into displayable rows: { key, displayValue, isArrayItem }
  const flattenParamsToRows = (params: Record<string, unknown>): Array<{ key: string; displayValue: string; isFirstOfKey: boolean }> => {
    const rows: Array<{ key: string; displayValue: string; isFirstOfKey: boolean }> = []
    const entries = Object.entries(params).filter(([key]) => key !== 'user')
    
    for (const [key, value] of entries) {
      const parsed = tryParseJSON(value)
      // If it's an array of arrays, each inner array becomes a row
      if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(v => Array.isArray(v))) {
        parsed.forEach((inner, idx) => {
          rows.push({
            key,
            displayValue: JSON.stringify(inner),
            isFirstOfKey: idx === 0,
          })
        })
      } else if (Array.isArray(parsed)) {
        rows.push({ key, displayValue: JSON.stringify(parsed), isFirstOfKey: true })
      } else if (parsed && typeof parsed === 'object') {
        rows.push({ key, displayValue: JSON.stringify(parsed), isFirstOfKey: true })
      } else {
        rows.push({ key, displayValue: String(parsed ?? ''), isFirstOfKey: true })
      }
    }
    return rows
  }

  const toggleRowExpand = (rowIndex: number) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev)
      if (newSet.has(rowIndex)) {
        newSet.delete(rowIndex)
      } else {
        newSet.add(rowIndex)
      }
      return newSet
    })
  }

  // Check if a row needs expansion (has params with multiple rows)
  const rowNeedsExpansion = (item: AnalyticsData): boolean => {
    if (!item.query_params) return false
    const allRows = flattenParamsToRows(item.query_params)
    return allRows.length > 1
  }

  const renderParams = (params?: Record<string, unknown>, rowIndex?: number) => {
    if (!params) {
      return <span className="text-gray-400">—</span>
    }
    const entries = Object.entries(params).filter(([key]) => key !== 'user')
    if (entries.length === 0) {
      return <span className="text-gray-400">—</span>
    }

    const isExpanded = rowIndex !== undefined && expandedRows.has(rowIndex)
    const allRows = flattenParamsToRows(params)
    const displayRows = isExpanded ? allRows : allRows.slice(0, 1)

    return (
      <div className="space-y-1">
        {displayRows.map((row, idx) => (
          <div key={`${row.key}-${idx}`} className="text-sm text-gray-900 dark:text-gray-100">
            {row.isFirstOfKey && (
              <span className="font-medium text-gray-600 dark:text-gray-300">{row.key}:</span>
            )}{' '}
            <span className="break-all">{row.displayValue}</span>
          </div>
        ))}
      </div>
    )
  }

  // Function to extract time from date string
  const getTimeFromDate = (dateString?: string): string => {
    if (!dateString) return '—'
    
    // Check if date string contains time (ISO format: YYYY-MM-DDTHH:mm:ss or with timezone)
    const timeMatch = dateString.match(/T(\d{2}:\d{2}(?::\d{2})?(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})?)/)
    if (timeMatch) {
      // Extract time portion (remove T and timezone info if present)
      let time = timeMatch[1]
      // Remove timezone info (Z or +HH:mm or -HH:mm)
      time = time.replace(/Z|[+-]\d{2}:\d{2}$/, '')
      // Remove milliseconds if present
      time = time.replace(/\.\d{3}$/, '')
      return time
    }
    
    // If no time found, return dash
    return '—'
  }

  // Function to get app name from endpoint
  const getAppFromEndpoint = (endpoint: string): string => {
    if (!endpoint) return '—'
    
    // First try exact match
    if (routeToAppMap[endpoint as keyof typeof routeToAppMap]) {
      return routeToAppMap[endpoint as keyof typeof routeToAppMap] as string
    }
    
    // Try to match with path parameters (e.g., /date_range/123 matches /date_range/{date_range_id})
    const endpointParts = endpoint.split('/').filter(Boolean)
    for (const [route, app] of Object.entries(routeToAppMap)) {
      const routeParts = route.split('/').filter(Boolean)
      if (routeParts.length === endpointParts.length) {
        let matches = true
        for (let i = 0; i < routeParts.length; i++) {
          // If route part is not a parameter placeholder, it must match exactly
          if (!routeParts[i].startsWith('{') && routeParts[i] !== endpointParts[i]) {
            matches = false
            break
          }
        }
        if (matches) {
          return app as string
        }
      }
    }
    
    // Try prefix match (e.g., /es/ps/extra matches /es/ps)
    for (const [route, app] of Object.entries(routeToAppMap)) {
      if (endpoint.startsWith(route)) {
        return app as string
      }
    }
    
    return '—'
  }

  // Handlers for user multi-select
  const toggleUser = (u: string) => {
    setSelectedUsers(prev => prev.includes(u) ? prev.filter(x => x !== u) : [...prev, u])
  }
  const selectAllUsers = () => setSelectedUsers(uniqueUsers)
  const clearAllUsers = () => setSelectedUsers([])

  // Handlers for columns menu
  const toggleColumn = (c: ColumnKey) => {
    setVisibleColumns(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
  }
  const selectAllColumns = () => setVisibleColumns(allFields)
  const clearAllColumns = () => setVisibleColumns([])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-red-600">Error: {error}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black p-6 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 sm:mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">User Analytics Dashboard</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Filter by user. Columns selectable. Data from backend API.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            {/* Unified Filters menu */}
            <div className="relative" ref={filterMenuRef}>
              <button
                onClick={() => setFilterMenuOpen(o => !o)}
                className={`w-full sm:w-auto inline-flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm shadow-sm hover:bg-gray-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${filterMenuOpen ? 'bg-gray-600 text-white hover:bg-gray-700' : 'bg-white text-gray-900 hover:bg-gray-50 border border-gray-300 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100'}`}
              >
                <span>Filters</span>
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.189l3.71-3.96a.75.75 0 111.08 1.04l-4.24 4.53a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
              </button>

              {filterMenuOpen && (
                <div className="absolute z-10 mt-2 w-[560px] roundedmd border border-gray-200 bg-white p-0 shadow-lg dark:border-gray-800 dark:bg-gray-900">
                  <div className="flex min-h-[220px]">
                    {/* Left: filter categories */}
                    <div className="w-48 border-r border-gray-200 dark:border-gray-800 p-2">
                      <button
                        className={`w-full text-left px-3 py-2 rounded text-sm ${activeFilterTab === 'users' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60'}`}
                        onClick={() => setActiveFilterTab('users')}
                      >
                        Users {selectedUsers.length > 0 ? `(${selectedUsers.length})` : ''}
                      </button>
                    </div>

                    {/* Right: active filter content */}
                    <div className="flex-1 p-3">
                      {activeFilterTab === 'users' && (
                        <div>
                          <div className="flex items-center justify-between px-1 py-1">
                            <div className="text-sm font-medium text-gray-700 dark:text-gray-200">Select users</div>
                            <div className="space-x-3">
                              <button onClick={selectAllUsers} className="text-xs text-blue-600 hover:underline">Select all</button>
                              <button onClick={clearAllUsers} className="text-xs text-gray-600 hover:underline">Clear</button>
                            </div>
                          </div>
                          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-64 overflow-auto pr-1">
                            {uniqueUsers.length === 0 && (
                              <div className="px-2 py-2 text-sm text-gray-500 dark:text-gray-400">No users found</div>
                            )}
                            {uniqueUsers.map(u => (
                              <label key={u} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-800/60 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedUsers.includes(u)}
                                  onChange={() => toggleUser(u)}
                                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-900 dark:text-gray-100 break-all">{u}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Columns menu */}
            <div className="relative" ref={columnsMenuRef}>
              <button
                onClick={() => setColumnsMenuOpen(o => !o)}
                className={`w-full sm:w-auto inline-flex items-center hover:bg-gray-700 cursor-pointer justify-between gap-2 rounded-md px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${columnsMenuOpen ? 'bg-gray-600 text-white hover:bg-gray-700' : 'bg-white text-gray-900 hover:bg-gray-50 border border-gray-300 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100'}`}
              >
                <span>Columns</span>
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.189l3.71-3.96a.75.75 0 111.08 1.04l-4.24 4.53a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
              </button>
              {columnsMenuOpen && (
                <div className="absolute z-10 mt-2 w-56 rounded-md border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-800 dark:bg-gray-900">
                  <div className="flex items-center justify-between px-1 py-1">
                    <button onClick={selectAllColumns} className="text-xs text-blue-600 hover:underline">Select all</button>
                    <button onClick={clearAllColumns} className="text-xs text-gray-600 hover:underline">Clear</button>
                  </div>
                  <div className="max-h-64 overflow-auto pr-1">
                    {allFields.map(c => (
                      <label key={c} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-800/60 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={visibleColumns.includes(c)}
                          onChange={() => toggleColumn(c)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-900 dark:text-gray-100 capitalize">{c}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Date filter temporarily removed */}
            {/*
            <div className="flex-1 sm:flex-none">
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
              />
            </div>
            */}
          </div>
        </div>

        {filteredData.length === 0 ? (
          <div className="text-center py-16 text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
            No data matches your filters
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                <thead className="bg-gray-50 dark:bg-gray-800/60">
                  <tr>
                    {visibleColumns.includes('datetime') && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                        <button
                          type="button"
                          onClick={() => handleSort('datetime')}
                          className="inline-flex items-center gap-1 hover:text-gray-900 dark:hover:text-white"
                        >
                          Date & Time {renderSortIcon('datetime')}
                        </button>
                      </th>
                    )}
                    {visibleColumns.includes('user') && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">User</th>
                    )}
                    {visibleColumns.includes('endpoint') && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Endpoint</th>
                    )}
                    {visibleColumns.includes('app') && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">App</th>
                    )}
                    {visibleColumns.includes('params') && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Params</th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredData.map((item, index) => {
                    const needsExpansion = rowNeedsExpansion(item)
                    const isExpanded = expandedRows.has(index)
                    const paramsRowCount = item.query_params ? flattenParamsToRows(item.query_params).length : 0
                    
                    // Determine the first visible column to add the expand icon
                    const firstVisibleColumn = visibleColumns[0]
                    
                    // Render expand icon inline with content (after content)
                    const renderExpandIcon = () => {
                      if (!needsExpansion) return null
                      return (
                        <button
                          onClick={() => toggleRowExpand(index)}
                          className="inline-flex items-center justify-center w-5 h-5 ml-2 rounded-full border border-gray-400 dark:border-gray-500 text-gray-500 dark:text-gray-400 hover:border-gray-600 dark:hover:border-gray-300 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer transition-colors flex-shrink-0"
                          title={isExpanded ? 'Collapse row' : `Expand row (+${paramsRowCount - 1} more)`}
                        >
                          {isExpanded ? (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                            </svg>
                          ) : (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                          )}
                        </button>
                      )
                    }
                    
                    return (
                      <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors">
                        {visibleColumns.includes('datetime') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                            <div className="flex items-center">
                              {formatDateTime(item)}
                              {firstVisibleColumn === 'datetime' && renderExpandIcon()}
                            </div>
                          </td>
                        )}
                        {visibleColumns.includes('user') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                            <div className="flex items-center">
                              {item.user}
                              {firstVisibleColumn === 'user' && renderExpandIcon()}
                            </div>
                          </td>
                        )}
                        {visibleColumns.includes('endpoint') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 font-medium">
                            <div className="flex items-center">
                              {item.endpoint}
                              {firstVisibleColumn === 'endpoint' && renderExpandIcon()}
                            </div>
                          </td>
                        )}
                        {visibleColumns.includes('app') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                            <div className="flex items-center">
                              {getAppFromEndpoint(item.endpoint)}
                              {firstVisibleColumn === 'app' && renderExpandIcon()}
                            </div>
                          </td>
                        )}
                        {visibleColumns.includes('params') && (
                          <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                            <div className="flex items-start">
                              {renderParams(item.query_params, index)}
                              {firstVisibleColumn === 'params' && renderExpandIcon()}
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between px-6 py-3 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/60">
              <span>Total: {filteredData.length}</span>
              <span>Users: {uniqueUsers.length} {selectedUsers.length > 0 ? `(selected: ${selectedUsers.length})` : ''}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default DashboardPage