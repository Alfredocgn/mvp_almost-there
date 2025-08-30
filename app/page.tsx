"use client"

import type React from "react"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Wallet, Users, Clock, Zap, ZoomIn, ZoomOut, ArrowLeft, Eye, MapPin } from "lucide-react"

const mockGameData = {
  playersNeeded: 6,
  currentPlayers: 3,
  gameStartsIn: 120, // seconds
  playerTurns: 5,
  mapSize: "50x50",
  prizePool: "0.5 ETH",
}

function TreasureMap({
  playerTurns,
  onTurnUsed,
  onBuyTurns,
  onTurnsChanged,
  selectedMainSquare,
  setSelectedMainSquare,
  cartFlags,
  setCartFlags,
  placedFlags,
  setPlacedFlags,
  submittedPointsCount,
  setSubmittedPointsCount,
}: {
  playerTurns: number
  onTurnUsed: () => void
  onBuyTurns: () => void
  onTurnsChanged: (turns: number) => void
  selectedMainSquare: { x: number; y: number } | null
  setSelectedMainSquare: (square: { x: number; y: number } | null) => void
  cartFlags: Set<string>
  setCartFlags: (flags: Set<string>) => void
  placedFlags: Set<string>
  setPlacedFlags: (flags: Set<string>) => void
  submittedPointsCount: number
  setSubmittedPointsCount: (count: number | ((prev: number) => number)) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const detailedMapRef = useRef<HTMLImageElement | null>(null)
  const simplifiedMapRef = useRef<HTMLImageElement | null>(null)
  const animationFrameRef = useRef<number>()
  const [zoomLevel, setZoomLevel] = useState(1)
  const [mapPosition, setMapPosition] = useState({ x: 0, y: 0 })
  const [playerSnapshots, setPlayerSnapshots] = useState<
    Array<{
      id: string
      timestamp: number
      playerPositions: Set<string>
      cost: number
      viewType: "main" | "detailed"
      detailedSquare?: { x: number; y: number }
    }>
  >([])
  const [activeSnapshot, setActiveSnapshot] = useState<string | null>(null)
  const snapshotCost = 0.005 // ETH per snapshot
  const pointCost = 0.001 // ETH per point
  const [imagesLoaded, setImagesLoaded] = useState({ detailed: false, simplified: false })
  const [animationTime, setAnimationTime] = useState(0)
  const mainMapSize = 4 // Main map is always 4x4
  const detailMapSize = 4 // Detail view is also 4x4
  const maxZoom = 3
  const minZoom = 0.5
  const canvasWidth = 600
  const canvasHeight = 600
  const [isDragging, setIsDragging] = useState(false)
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 })

  const generateMockPlayerPositions = (viewType: "main" | "detailed", detailedSquare?: { x: number; y: number }) => {
    const positions = new Set<string>()

    if (viewType === "main") {
      // For main view, only show which main squares have players (not exact positions)
      const occupiedSquares = Math.floor(Math.random() * 8) + 3 // 3-10 occupied squares
      for (let i = 0; i < occupiedSquares; i++) {
        const mainX = Math.floor(Math.random() * mainMapSize)
        const mainY = Math.floor(Math.random() * mainMapSize)
        // Use a special format for main square occupancy
        positions.add(`main-${mainX}-${mainY}`)
      }
    } else if (viewType === "detailed" && detailedSquare) {
      // For detailed view, show exact positions within the selected square
      const playersInSquare = Math.floor(Math.random() * 6) + 1 // 1-6 players in this square
      for (let i = 0; i < playersInSquare; i++) {
        const detailX = Math.floor(Math.random() * detailMapSize)
        const detailY = Math.floor(Math.random() * detailMapSize)
        positions.add(`flag-${detailedSquare.x}-${detailedSquare.y}-${detailX}-${detailY}`)
      }
    }

    return positions
  }

  const purchaseSnapshot = () => {
    if (playerTurns < 1) return // Need at least 1 turn to purchase

    const viewType = selectedMainSquare ? "detailed" : "main"
    const snapshot = {
      id: `snapshot-${Date.now()}`,
      timestamp: Date.now(),
      playerPositions: generateMockPlayerPositions(viewType, selectedMainSquare || undefined),
      cost: snapshotCost,
      viewType,
      detailedSquare: selectedMainSquare || undefined,
    }

    setPlayerSnapshots((prev) => [...prev, snapshot])
    setActiveSnapshot(snapshot.id)
    onTurnUsed() // Use one turn for the snapshot

    // Auto-hide snapshot after 30 seconds
    setTimeout(() => {
      setActiveSnapshot(null)
    }, 30000)
  }

  const getMainSquareKey = (gridX: number, gridY: number) => `main-${gridX}-${gridY}`
  const getFlagKey = (mainX: number, mainY: number, detailX: number, detailY: number) =>
    `flag-${mainX}-${mainY}-${detailX}-${detailY}`

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.fillStyle = "#1e293b" // slate-800
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)

    ctx.save()

    const centerX = canvasWidth / 2
    const centerY = canvasHeight / 2
    ctx.translate(centerX + mapPosition.x, centerY + mapPosition.y)
    ctx.scale(zoomLevel, zoomLevel)
    ctx.translate(-centerX, -centerY)

    if (selectedMainSquare) {
      if (detailedMapRef.current && imagesLoaded.detailed) {
        ctx.imageSmoothingEnabled = false
        const cropX = (selectedMainSquare.x / mainMapSize) * detailedMapRef.current.width
        const cropY = (selectedMainSquare.y / mainMapSize) * detailedMapRef.current.height
        const cropWidth = detailedMapRef.current.width / mainMapSize
        const cropHeight = detailedMapRef.current.height / mainMapSize

        ctx.drawImage(detailedMapRef.current, cropX, cropY, cropWidth, cropHeight, 0, 0, canvasWidth, canvasHeight)
      }

      ctx.strokeStyle = "#64748b" // slate-500
      ctx.lineWidth = 2
      ctx.globalAlpha = 0.7

      for (let i = 0; i <= detailMapSize; i++) {
        const x = (i / detailMapSize) * canvasWidth
        const y = (i / detailMapSize) * canvasHeight

        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, canvasHeight)
        ctx.stroke()

        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(canvasWidth, y)
        ctx.stroke()
      }

      ctx.globalAlpha = 1

      placedFlags.forEach((flagKey) => {
        const parts = flagKey.split("-")
        if (parts.length === 5 && parts[0] === "flag") {
          const [, mainX, mainY, detailX, detailY] = parts.map(Number)

          if (mainX === selectedMainSquare.x && mainY === selectedMainSquare.y) {
            const flagX = (detailX / detailMapSize) * canvasWidth + canvasWidth / detailMapSize / 2
            const flagY = (detailY / detailMapSize) * canvasHeight + canvasHeight / detailMapSize / 2

            const waveOffset = Math.sin(animationTime * 0.003 + flagX * 0.01) * 3
            const currentFlagY = flagY + waveOffset

            ctx.fillStyle = "#22c55e" // green-500 for submitted flags
            ctx.beginPath()
            ctx.arc(flagX, currentFlagY, 8, 0, 2 * Math.PI)
            ctx.fill()

            ctx.fillStyle = "#ffffff"
            ctx.font = "16px monospace"
            ctx.textAlign = "center"
            ctx.fillText("✓", flagX, currentFlagY + 5)
          }
        }
      })

      cartFlags.forEach((flagKey) => {
        const parts = flagKey.split("-")
        if (parts.length === 5 && parts[0] === "flag") {
          const [, mainX, mainY, detailX, detailY] = parts.map(Number)

          if (mainX === selectedMainSquare.x && mainY === selectedMainSquare.y) {
            const flagX = (detailX / detailMapSize) * canvasWidth + canvasWidth / detailMapSize / 2
            const flagY = (detailY / detailMapSize) * canvasHeight + canvasHeight / detailMapSize / 2

            const waveOffset = Math.sin(animationTime * 0.003 + flagX * 0.01) * 3
            const currentFlagY = flagY + waveOffset

            ctx.fillStyle = "#f59e0b" // amber-500 for cart flags
            ctx.beginPath()
            ctx.arc(flagX, currentFlagY, 8, 0, 2 * Math.PI)
            ctx.fill()

            ctx.fillStyle = "#ffffff"
            ctx.font = "16px monospace"
            ctx.textAlign = "center"
            ctx.fillText("🛒", flagX, currentFlagY + 5)
          }
        }
      })

      if (activeSnapshot) {
        const snapshot = playerSnapshots.find((s) => s.id === activeSnapshot)
        if (snapshot) {
          if (snapshot.viewType === "main" && !selectedMainSquare) {
            // Render main square occupancy indicators
            snapshot.playerPositions.forEach((flagKey) => {
              if (flagKey.startsWith("main-")) {
                const [, mainX, mainY] = flagKey.split("-").map(Number)
                const flagX = (mainX / mainMapSize) * canvasWidth
                const flagY = (mainY / mainMapSize) * canvasHeight

                // Draw pulsing indicator for occupied squares
                const pulseIntensity = 0.5 + 0.3 * Math.sin(animationTime * 0.003)
                ctx.fillStyle = `rgba(6, 182, 212, ${pulseIntensity})` // cyan with pulsing alpha
                ctx.strokeStyle = "#0891b2" // cyan-600
                ctx.lineWidth = 3

                ctx.beginPath()
                ctx.arc(
                  flagX + canvasWidth / mainMapSize / 2,
                  flagY + canvasHeight / mainMapSize / 2,
                  15,
                  0,
                  2 * Math.PI,
                )
                ctx.fill()
                ctx.stroke()

                ctx.fillStyle = "white"
                ctx.font = "bold 14px monospace"
                ctx.textAlign = "center"
                ctx.textBaseline = "middle"
                ctx.fillText("👥", flagX + canvasWidth / mainMapSize / 2, flagY + canvasHeight / mainMapSize / 2)
              }
            })
          } else if (
            snapshot.viewType === "detailed" &&
            selectedMainSquare &&
            snapshot.detailedSquare?.x === selectedMainSquare.x &&
            snapshot.detailedSquare?.y === selectedMainSquare.y
          ) {
            // Render detailed positions within the current square
            snapshot.playerPositions.forEach((flagKey) => {
              if (flagKey.startsWith("flag-")) {
                const parts = flagKey.split("-")
                const [, mainX, mainY, detailX, detailY] = parts.map(Number)

                const flagX = (detailX / detailMapSize) * canvasWidth
                const flagY = (detailY / detailMapSize) * canvasHeight

                ctx.fillStyle = "#06b6d4" // cyan-500
                ctx.strokeStyle = "#0891b2" // cyan-600
                ctx.lineWidth = 2
                ctx.font = "bold 20px monospace"
                ctx.textAlign = "center"
                ctx.textBaseline = "middle"

                ctx.beginPath()
                ctx.arc(
                  flagX + canvasWidth / detailMapSize / 2,
                  flagY + canvasHeight / detailMapSize / 2,
                  12,
                  0,
                  2 * Math.PI,
                )
                ctx.fill()
                ctx.stroke()

                ctx.fillStyle = "white"
                ctx.fillText("P", flagX + canvasWidth / detailMapSize / 2, flagY + canvasHeight / detailMapSize / 2)
              }
            })
          }
        }
      }
    } else {
      const squaresWithSubmittedFlags = new Map<string, number>()
      const squaresWithCartFlags = new Map<string, number>()

      placedFlags.forEach((flagKey) => {
        const parts = flagKey.split("-")
        if (parts.length === 5 && parts[0] === "flag") {
          const [, mainX, mainY] = parts.map(Number)
          const squareKey = `${mainX}-${mainY}`
          squaresWithSubmittedFlags.set(squareKey, (squaresWithSubmittedFlags.get(squareKey) || 0) + 1)
        }
      })

      cartFlags.forEach((flagKey) => {
        const parts = flagKey.split("-")
        if (parts.length === 5 && parts[0] === "flag") {
          const [, mainX, mainY] = parts.map(Number)
          const squareKey = `${mainX}-${mainY}`
          squaresWithCartFlags.set(squareKey, (squaresWithCartFlags.get(squareKey) || 0) + 1)
        }
      })

      if (detailedMapRef.current && imagesLoaded.detailed) {
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(detailedMapRef.current, 0, 0, canvasWidth, canvasHeight)
      }

      if (simplifiedMapRef.current && imagesLoaded.simplified) {
        ctx.imageSmoothingEnabled = false

        for (let x = 0; x < mainMapSize; x++) {
          for (let y = 0; y < mainMapSize; y++) {
            const squareKey = `${x}-${y}`

            if (!squaresWithSubmittedFlags.has(squareKey) && !squaresWithCartFlags.has(squareKey)) {
              const squareX = (x / mainMapSize) * canvasWidth
              const squareY = (y / mainMapSize) * canvasHeight
              const squareWidth = canvasWidth / mainMapSize
              const squareHeight = canvasHeight / mainMapSize

              const cropX = (x / mainMapSize) * simplifiedMapRef.current.width
              const cropY = (y / mainMapSize) * simplifiedMapRef.current.height
              const cropWidth = simplifiedMapRef.current.width / mainMapSize
              const cropHeight = simplifiedMapRef.current.height / mainMapSize

              ctx.globalAlpha = 0.8
              ctx.drawImage(
                simplifiedMapRef.current,
                cropX,
                cropY,
                cropWidth,
                cropHeight,
                squareX,
                squareY,
                squareWidth,
                squareHeight,
              )
            }
          }
        }
        ctx.globalAlpha = 1
      }

      ctx.strokeStyle = "#64748b" // slate-500
      ctx.lineWidth = 3
      ctx.globalAlpha = 0.8

      for (let i = 0; i <= mainMapSize; i++) {
        const x = (i / mainMapSize) * canvasWidth
        const y = (i / mainMapSize) * canvasHeight

        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, canvasHeight)
        ctx.stroke()

        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(canvasWidth, y)
        ctx.stroke()
      }

      ctx.globalAlpha = 1

      squaresWithSubmittedFlags.forEach((flagCount, squareKey) => {
        const [x, y] = squareKey.split("-").map(Number)
        const squareX = (x / mainMapSize) * canvasWidth
        const squareY = (y / mainMapSize) * canvasHeight
        const squareWidth = canvasWidth / mainMapSize
        const squareHeight = canvasHeight / mainMapSize

        const pulseIntensity = 0.5 + 0.5 * Math.sin(animationTime * 0.005)
        ctx.strokeStyle = `rgba(34, 197, 94, ${pulseIntensity})` // green with pulse
        ctx.lineWidth = 4
        ctx.strokeRect(squareX + 2, squareY + 2, squareWidth - 4, squareHeight - 4)

        const centerX = squareX + squareWidth / 2
        const centerY = squareY + squareHeight / 2

        const breathe = 20 + Math.sin(animationTime * 0.004) * 3
        ctx.fillStyle = "#22c55e" // green-500
        ctx.beginPath()
        ctx.arc(centerX, centerY, breathe, 0, 2 * Math.PI)
        ctx.fill()

        ctx.fillStyle = "#ffffff"
        ctx.font = "bold 24px monospace"
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText(flagCount.toString(), centerX, centerY)
      })

      squaresWithCartFlags.forEach((flagCount, squareKey) => {
        const [x, y] = squareKey.split("-").map(Number)
        const squareX = (x / mainMapSize) * canvasWidth
        const squareY = (y / mainMapSize) * canvasHeight
        const squareWidth = canvasWidth / mainMapSize
        const squareHeight = canvasHeight / mainMapSize

        const pulseIntensity = 0.5 + 0.5 * Math.sin(animationTime * 0.005)
        ctx.strokeStyle = `rgba(245, 158, 11, ${pulseIntensity})` // amber with pulse
        ctx.lineWidth = 4
        ctx.strokeRect(squareX + 2, squareY + 2, squareWidth - 4, squareHeight - 4)

        const centerX = squareX + squareWidth / 2
        const centerY = squareY + squareHeight / 2 - 15 // Offset for cart flags

        const breathe = 15 + Math.sin(animationTime * 0.004) * 2
        ctx.fillStyle = "#f59e0b" // amber-500
        ctx.beginPath()
        ctx.arc(centerX, centerY, breathe, 0, 2 * Math.PI)
        ctx.fill()

        ctx.fillStyle = "#ffffff"
        ctx.font = "bold 18px monospace"
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText(flagCount.toString(), centerX, centerY)

        ctx.fillStyle = "#ffffff"
        ctx.font = "12px monospace"
        ctx.fillText("🛒", centerX, centerY + 25)
      })

      if (activeSnapshot) {
        const snapshot = playerSnapshots.find((s) => s.id === activeSnapshot)
        if (snapshot) {
          snapshot.playerPositions.forEach((flagKey) => {
            const parts = flagKey.split("-")
            const [, mainX, mainY, detailX, detailY] = parts.map(Number)

            if (selectedMainSquare) {
              if (mainX === selectedMainSquare.x && mainY === selectedMainSquare.y) {
                const flagX = (detailX / detailMapSize) * canvasWidth
                const flagY = (detailY / detailMapSize) * canvasHeight

                ctx.fillStyle = "#06b6d4" // cyan-500
                ctx.strokeStyle = "#0891b2" // cyan-600
                ctx.lineWidth = 2
                ctx.font = "bold 20px monospace"
                ctx.textAlign = "center"
                ctx.textBaseline = "middle"

                ctx.beginPath()
                ctx.arc(
                  flagX + canvasWidth / detailMapSize / 2,
                  flagY + canvasHeight / detailMapSize / 2,
                  12,
                  0,
                  2 * Math.PI,
                )
                ctx.fill()
                ctx.stroke()

                ctx.fillStyle = "white"
                ctx.fillText("P", flagX + canvasWidth / detailMapSize / 2, flagY + canvasHeight / detailMapSize / 2)
              }
            } else {
              const flagX = (mainX / mainMapSize) * canvasWidth
              const flagY = (mainY / mainMapSize) * canvasHeight

              ctx.fillStyle = "#06b6d4" // cyan-500
              ctx.beginPath()
              ctx.arc(flagX + canvasWidth / mainMapSize / 2, flagY + canvasHeight / mainMapSize / 2, 8, 0, 2 * Math.PI)
              ctx.fill()

              ctx.fillStyle = "white"
              ctx.font = "bold 12px monospace"
              ctx.textAlign = "center"
              ctx.textBaseline = "middle"
              ctx.fillText("P", flagX + canvasWidth / mainMapSize / 2, flagY + canvasHeight / mainMapSize / 2)
            }
          })
        }
      }
    }

    ctx.restore()
  }, [
    zoomLevel,
    mapPosition,
    selectedMainSquare,
    placedFlags,
    cartFlags,
    imagesLoaded,
    mainMapSize,
    detailMapSize,
    animationTime,
    activeSnapshot,
    playerSnapshots,
  ])

  const handleCanvasClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (isDragging) return

      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const mouseX = event.clientX - rect.left
      const mouseY = event.clientY - rect.top

      const centerX = canvasWidth / 2
      const centerY = canvasHeight / 2

      const transformedX = (mouseX - centerX - mapPosition.x) / zoomLevel + centerX
      const transformedY = (mouseY - centerY - mapPosition.y) / zoomLevel + centerY

      if (selectedMainSquare) {
        const currentAvailablePoints = 50 - submittedPointsCount - cartFlags.size
        if (currentAvailablePoints <= 0) {
          alert("No available points left!")
          return
        }

        const detailX = Math.floor((transformedX / canvasWidth) * detailMapSize)
        const detailY = Math.floor((transformedY / canvasHeight) * detailMapSize)

        if (detailX >= 0 && detailX < detailMapSize && detailY >= 0 && detailY < detailMapSize) {
          const flagKey = getFlagKey(selectedMainSquare.x, selectedMainSquare.y, detailX, detailY)

          if (cartFlags.has(flagKey)) {
            removeFromCart(flagKey)
            return
          }

          if (placedFlags.has(flagKey)) {
            return
          }

          if (submittedPointsCount + cartFlags.size >= 50) {
            alert(`Maximum 50 points per game reached!`)
            return
          }

          const newCartFlags = new Set(cartFlags)
          newCartFlags.add(flagKey)
          setCartFlags(newCartFlags)
        }
      } else {
        const mainX = Math.floor((transformedX / canvasWidth) * mainMapSize)
        const mainY = Math.floor((transformedY / canvasHeight) * mainMapSize)

        if (mainX >= 0 && mainX < mainMapSize && mainY >= 0 && mainY < mainMapSize) {
          setSelectedMainSquare({ x: mainX, y: mainY })
        }
      }
    },
    [
      playerTurns,
      isDragging,
      zoomLevel,
      mapPosition,
      selectedMainSquare,
      placedFlags,
      cartFlags,
      mainMapSize,
      detailMapSize,
      onTurnUsed,
      submittedPointsCount,
    ],
  )

  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true)
    setLastMousePos({ x: event.clientX, y: event.clientY })
  }, [])

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDragging) return

      const deltaX = event.clientX - lastMousePos.x
      const deltaY = event.clientY - lastMousePos.y

      setMapPosition((prev) => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY,
      }))

      setLastMousePos({ x: event.clientX, y: event.clientY })
    },
    [isDragging, lastMousePos],
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    const loadImages = () => {
      const detailedImg = new Image()
      detailedImg.onload = () => {
        detailedMapRef.current = detailedImg
        setImagesLoaded((prev) => ({ ...prev, detailed: true }))
      }
      detailedImg.src = "/detailed-buenos-aires-city-map-with-all-streets-av.png"

      const simplifiedImg = new Image()
      simplifiedImg.onload = () => {
        simplifiedMapRef.current = simplifiedImg
        setImagesLoaded((prev) => ({ ...prev, simplified: true }))
      }
      simplifiedImg.src = "/simplified-buenos-aires-map-with-key-landmarks-on.png"
    }

    loadImages()
  }, [])

  useEffect(() => {
    drawCanvas()
  }, [drawCanvas])

  const handleZoomIn = () => {
    if (zoomLevel < maxZoom) {
      setZoomLevel((prev) => Math.min(prev + 0.5, maxZoom))
    }
  }

  const handleZoomOut = () => {
    if (zoomLevel > minZoom) {
      setZoomLevel((prev) => Math.max(prev - 0.5, minZoom))
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const totalFlags = placedFlags.size
  const cartSize = cartFlags.size
  const cartTotal = cartSize * pointCost
  const availablePoints = 50 - submittedPointsCount - cartFlags.size
  const totalPossibleFlags = mainMapSize * mainMapSize * detailMapSize * detailMapSize

  const removeFromCart = (flagKey: string) => {
    const newCartFlags = new Set(cartFlags)
    newCartFlags.delete(flagKey)
    setCartFlags(newCartFlags)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Map Canvas - Full Height */}
      <div className="flex-1 relative">
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          onClick={handleCanvasClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
          className={`w-full h-full ${
            selectedMainSquare ? (availablePoints > 0 ? "cursor-crosshair" : "cursor-not-allowed") : "cursor-pointer"
          } ${isDragging ? "cursor-grabbing" : ""}`}
          style={{
            objectFit: "contain",
          }}
        />

        {/* Zoom Controls - Floating */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-white/90 rounded-full p-1 shadow-sm">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleZoomOut}
            disabled={zoomLevel <= minZoom}
            className="h-7 w-7 p-0"
          >
            <ZoomOut className="w-3 h-3" />
          </Button>
          <span className="text-xs text-muted-foreground px-2 min-w-[40px] text-center">
            {Math.round(zoomLevel * 100)}%
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleZoomIn}
            disabled={zoomLevel >= maxZoom}
            className="h-7 w-7 p-0"
          >
            <ZoomIn className="w-3 h-3" />
          </Button>
        </div>

        {/* View Indicator - Floating */}
        <div className="absolute top-3 left-3">
          <Badge variant={selectedMainSquare ? "default" : "secondary"} className="text-xs">
            {selectedMainSquare ? `Detail (${selectedMainSquare.x + 1},${selectedMainSquare.y + 1})` : "Main View"}
          </Badge>
        </div>

        {/* Intel Status - Floating */}
        {activeSnapshot && (
          <div className="absolute top-3 right-3">
            <Badge variant="default" className="bg-cyan-500 text-xs">
              <Eye className="w-3 h-3 mr-1" />
              Intel (
              {Math.ceil(
                (30000 - (Date.now() - playerSnapshots.find((s) => s.id === activeSnapshot)!.timestamp)) / 1000,
              )}
              s)
            </Badge>
          </div>
        )}
      </div>
    </div>
  )
}

export default function TreasureHuntGame() {
  const [isConnected, setIsConnected] = useState(false)
  const [address, setAddress] = useState("")
  const [isConnecting, setIsConnecting] = useState(false)
  const [gameTimer, setGameTimer] = useState(mockGameData.gameStartsIn)
  const [gameState, setGameState] = useState<"lobby" | "playing">("lobby")
  const [playerTurns, setPlayerTurns] = useState(mockGameData.playerTurns)
  const [selectedMainSquare, setSelectedMainSquare] = useState<{ x: number; y: number } | null>(null)
  const [cartFlags, setCartFlags] = useState<Set<string>>(new Set()) // Pending flags in cart
  const [placedFlags, setPlacedFlags] = useState<Set<string>>(new Set()) // Submitted flags
  const [submittedPointsCount, setSubmittedPointsCount] = useState(0) // Total submitted across all transactions
  const maxPointsPerGame = 50
  const pointCost = 0.001

  useEffect(() => {
    if (gameTimer > 0 && gameState === "lobby") {
      const timer = setInterval(() => {
        setGameTimer((prev) => prev - 1)
      }, 1000)
      return () => clearInterval(timer)
    } else if (gameTimer === 0 && gameState === "lobby") {
      setGameState("playing")
    }
  }, [gameTimer, gameState])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handleTurnUsed = () => {
    setPlayerTurns((prev) => Math.max(0, prev - 1))
  }

  const handleBuyTurns = () => {
    setPlayerTurns((prev) => prev + 5)
  }

  const handleTurnsChanged = (newTurns: number) => {
    setPlayerTurns(newTurns)
  }

  const handleJoinGame = () => {
    setGameState("playing")
    setGameTimer(0)
  }

  const connectWallet = async () => {
    setIsConnecting(true)
    // Simulate connection delay
    setTimeout(() => {
      setIsConnected(true)
      setAddress("0x1234...5678")
      setIsConnecting(false)
    }, 1000)
  }

  const disconnectWallet = () => {
    setIsConnected(false)
    setAddress("")
  }

  const clearCart = () => {
    setCartFlags(new Set())
  }

  const submitCart = async () => {
    if (cartFlags.size === 0) return

    try {
      console.log("[v0] Submitting to contract:", Array.from(cartFlags))

      const newPlacedFlags = new Set([...placedFlags, ...cartFlags])
      setPlacedFlags(newPlacedFlags)
      setSubmittedPointsCount((prev) => prev + cartFlags.size)

      setCartFlags(new Set())

      alert(`Successfully submitted ${cartFlags.size} points to the contract!`)
    } catch (error) {
      console.error("[v0] Contract submission failed:", error)
      alert("Failed to submit to contract. Please try again.")
    }
  }

  const availablePoints = maxPointsPerGame - submittedPointsCount - cartFlags.size
  const cartSize = cartFlags.size
  const totalFlags = placedFlags.size
  const cartTotal = cartSize * pointCost

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50">
      {!isConnected ? (
        <div className="px-4 py-8">
          <div className="max-w-sm mx-auto">
            <Card className="text-center">
              <CardHeader className="pb-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Wallet className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-xl">Connect Your Wallet</CardTitle>
                <CardDescription className="text-sm">
                  Connect your Coinbase Wallet to join the treasure hunt on Base
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={connectWallet} disabled={isConnecting} className="w-full" size="lg">
                  <Wallet className="w-5 h-5 mr-2" />
                  {isConnecting ? "Connecting..." : "Connect Wallet"}
                </Button>
                <p className="text-xs text-muted-foreground">Base mini app for Coinbase Wallet</p>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : gameState === "playing" ? (
        <div className="flex flex-col h-screen max-w-sm mx-auto bg-white">
          {/* Compact Mobile Header */}
          <div className="bg-white border-b px-3 py-2 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-gradient-to-br from-amber-600 to-orange-600 rounded-md flex items-center justify-center">
                  <MapPin className="w-3 h-3 text-white" />
                </div>
                <h1 className="text-sm font-bold text-amber-900">Buenos Aires Hunt</h1>
              </div>
              <div className="flex items-center gap-2">
                {selectedMainSquare && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedMainSquare(null)}
                    className="h-6 px-2 text-xs bg-amber-100 hover:bg-amber-200"
                  >
                    <ArrowLeft className="w-3 h-3 mr-1" />
                    Back
                  </Button>
                )}
                <Badge variant="outline" className="text-xs px-1 py-0.5 h-6">
                  <Clock className="w-3 h-3 mr-1" />
                  {formatTime(300)}
                </Badge>
              </div>
            </div>
          </div>

          {/* Full Screen Map Area */}
          <div className="flex-1 relative bg-gray-50">
            <TreasureMap
              playerTurns={playerTurns}
              onTurnUsed={handleTurnUsed}
              onBuyTurns={handleBuyTurns}
              onTurnsChanged={handleTurnsChanged}
              selectedMainSquare={selectedMainSquare}
              setSelectedMainSquare={setSelectedMainSquare}
              cartFlags={cartFlags}
              setCartFlags={setCartFlags}
              placedFlags={placedFlags}
              setPlacedFlags={setPlacedFlags}
              submittedPointsCount={submittedPointsCount}
              setSubmittedPointsCount={setSubmittedPointsCount}
            />
          </div>

          {/* Compact Bottom Actions */}
          <div className="bg-white border-t px-3 py-2 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3 text-xs">
                <span className="text-amber-600 font-medium">{cartSize} in cart</span>
                <span className="text-green-600 font-medium">{totalFlags} submitted</span>
                <span className="text-gray-500">
                  {availablePoints}/{maxPointsPerGame} left
                </span>
              </div>
              <span className="font-mono text-sm font-bold">{cartTotal.toFixed(3)} ETH</span>
            </div>

            <div className="flex gap-2">
              <Button onClick={submitCart} disabled={cartSize === 0} size="sm" className="flex-1 h-8">
                Submit ({cartSize})
              </Button>
              <Button
                onClick={clearCart}
                disabled={cartSize === 0}
                variant="outline"
                size="sm"
                className="h-8 px-3 bg-transparent"
              >
                Clear
              </Button>
              <Button
                onClick={() => {}}
                disabled={availablePoints === 0}
                variant="outline"
                size="sm"
                className="h-8 px-3"
              >
                <Eye className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="px-4 py-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-600 to-orange-600 rounded-xl flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-amber-900 mb-2">Colegiales Treasure Hunt</h2>
            <p className="text-amber-700 text-sm">Join the multiplayer adventure</p>
          </div>

          <div className="space-y-4 max-w-sm mx-auto">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="w-5 h-5" />
                  Game Lobby
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Players</span>
                  <Badge variant="secondary">
                    {mockGameData.currentPlayers}/{mockGameData.playersNeeded}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Starts in</span>
                  <Badge variant="outline" className="font-mono">
                    <Clock className="w-4 h-4 mr-1" />
                    {formatTime(gameTimer)}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Prize Pool</span>
                  <Badge variant="secondary" className="text-accent">
                    <Zap className="w-4 h-4 mr-1" />
                    {mockGameData.prizePool}
                  </Badge>
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleJoinGame}
                  disabled={mockGameData.currentPlayers >= mockGameData.playersNeeded}
                >
                  {mockGameData.currentPlayers >= mockGameData.playersNeeded ? "Game Full" : "Join Game"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Zap className="w-5 h-5" />
                  Get More Turns
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button onClick={handleBuyTurns} variant="outline" className="w-full bg-transparent" size="lg">
                  <Zap className="w-4 h-4 mr-2" />
                  Buy 5 Turns (0.01 ETH)
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
