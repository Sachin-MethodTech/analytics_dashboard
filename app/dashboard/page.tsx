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

  // Function to format date and time together
  const formatDateTime = (item: AnalyticsData): string => {
    // If date already contains full datetime in "YYYY-MM-DD HH:MM:SS" format
    if (item.date && item.date.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/)) {
      return item.date
    }
    
    // If date contains ISO format with T separator
    if (item.date && item.date.includes('T')) {
      // Convert ISO format to "YYYY-MM-DD HH:MM:SS"
      const isoDate = new Date(item.date)
      if (!Number.isNaN(isoDate.getTime())) {
        const dateStr = isoDate.toISOString().slice(0, 10)
        const timeStr = isoDate.toTimeString().slice(0, 8)
        return `${dateStr} ${timeStr}`
      }
    }
    
    // Otherwise, combine separate date and time fields
    const normalizedDate = (item.date && item.date.slice(0, 10)) || tempDate
    const time = item.time || getTimeFromDate(item.date)
    
    if (time === '—') {
      return normalizedDate
    }
    
    return `${normalizedDate} ${time}`
  }

  const renderValue = (value: unknown) => {
    // If value is a string that looks like a JSON array, attempt to parse
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
        try {
          const parsed = JSON.parse(trimmed)
          return renderValue(parsed)
        } catch {
          // fall through to render as plain string
        }
      }
      return <span className="break-all">{trimmed}</span>
    }

    // Array of arrays: show each inner array on its own line
    if (Array.isArray(value) && value.every(v => Array.isArray(v))) {
      return (
        <div className="space-y-1">
          {(value as unknown[]).map((inner, idx) => (
            <div key={idx} className="break-all">{JSON.stringify(inner)}</div>
          ))}
        </div>
      )
    }
    // Generic array: compact JSON
    if (Array.isArray(value)) {
      return <span className="break-all">{JSON.stringify(value)}</span>
    }
    // Objects: stringify compactly
    if (value && typeof value === 'object') {
      return <span className="break-all">{JSON.stringify(value)}</span>
    }
    // Primitives
    return <span className="break-all">{String(value ?? '')}</span>
  }

  const renderParams = (params?: Record<string, unknown>) => {
    if (!params) {
      return <span className="text-gray-400">—</span>
    }
    const entries = Object.entries(params).filter(([key]) => key !== 'user')
    if (entries.length === 0) {
      return <span className="text-gray-400">—</span>
    }
    return (
      <div className="space-y-1">
        {entries.map(([key, value]) => (
          <div key={key} className="text-sm text-gray-900 dark:text-gray-100">
            <span className="font-medium text-gray-600 dark:text-gray-300">{key}:</span>{' '}
            {renderValue(value)}
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
                    return (
                      <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors">
                        {visibleColumns.includes('datetime') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{formatDateTime(item)}</td>
                        )}
                        {visibleColumns.includes('user') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{item.user}</td>
                        )}
                        {visibleColumns.includes('endpoint') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 font-medium">{item.endpoint}</td>
                        )}
                        {visibleColumns.includes('app') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{getAppFromEndpoint(item.endpoint)}</td>
                        )}
                        {visibleColumns.includes('params') && (
                          <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">{renderParams(item.query_params)}</td>
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