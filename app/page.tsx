"use client"

import type React from "react"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Wallet,
  Users,
  MapPin,
  Coins,
  Timer,
  Zap,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Eye,
  ArrowLeft,
  Flag,
} from "lucide-react"

// Mock wallet connection hook
function useWallet() {
  const [isConnected, setIsConnected] = useState(false)
  const [address, setAddress] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)

  const connectWallet = async () => {
    setIsConnecting(true)
    // Simulate wallet connection
    setTimeout(() => {
      setIsConnected(true)
      setAddress("0x1234...5678")
      setIsConnecting(false)
    }, 1500)
  }

  const disconnectWallet = () => {
    setIsConnected(false)
    setAddress(null)
  }

  return { isConnected, address, isConnecting, connectWallet, disconnectWallet }
}

function TreasureMap({
  playerTurns,
  onTurnUsed,
  onBuyTurns,
  onTurnsChanged,
}: {
  playerTurns: number
  onTurnUsed: () => void
  onBuyTurns: () => void
  onTurnsChanged: (turns: number) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const detailedMapRef = useRef<HTMLImageElement | null>(null)
  const simplifiedMapRef = useRef<HTMLImageElement | null>(null)
  const animationFrameRef = useRef<number>()
  const [zoomLevel, setZoomLevel] = useState(1)
  const [mapPosition, setMapPosition] = useState({ x: 0, y: 0 })
  const [selectedMainSquare, setSelectedMainSquare] = useState<{ x: number; y: number } | null>(null)
  const [placedFlags, setPlacedFlags] = useState<Set<string>>(new Set()) // Submitted flags
  const [cartFlags, setCartFlags] = useState<Set<string>>(new Set()) // Pending flags in cart
  const [maxPointsPerGame] = useState(50) // Contract limit
  const [submittedPointsCount, setSubmittedPointsCount] = useState(0) // Total submitted across all transactions
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
        const currentAvailablePoints = maxPointsPerGame - submittedPointsCount - cartFlags.size
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

          if (submittedPointsCount + cartFlags.size >= maxPointsPerGame) {
            alert(`Maximum ${maxPointsPerGame} points per game reached!`)
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
      maxPointsPerGame,
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
      // Load detailed Buenos Aires map
      const detailedImg = new Image()
      detailedImg.onload = () => {
        detailedMapRef.current = detailedImg
        setImagesLoaded((prev) => ({ ...prev, detailed: true }))
      }
      detailedImg.src = "/detailed-buenos-aires-city-map-with-all-streets-av.png"

      // Load simplified Buenos Aires map
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
  const availablePoints = maxPointsPerGame - submittedPointsCount - cartFlags.size
  const totalPossibleFlags = mainMapSize * mainMapSize * detailMapSize * detailMapSize

  const removeFromCart = (flagKey: string) => {
    const newCartFlags = new Set(cartFlags)
    newCartFlags.delete(flagKey)
    setCartFlags(newCartFlags)
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

  const clearCart = () => {
    setCartFlags(new Set())
  }

  return (
    <div className="flex gap-6">
      <div className="w-80 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center text-white text-xs">
                🛒
              </div>
              Shopping Cart
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Items in cart</span>
                <span className="font-mono text-lg">{cartSize}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total cost</span>
                <span className="font-mono text-lg">{cartTotal.toFixed(3)} ETH</span>
              </div>
              <div className="flex gap-2">
                <Button onClick={submitCart} disabled={cartSize === 0} className="flex-1" size="sm">
                  Submit to Contract
                </Button>
                <Button onClick={clearCart} disabled={cartSize === 0} variant="outline" size="sm">
                  Clear
                </Button>
              </div>
            </div>

            <div className="pt-2 border-t">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Available points</span>
                  <span className="font-mono">
                    {availablePoints}/{maxPointsPerGame}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">In cart</span>
                  <span className="font-mono text-amber-600">{cartSize}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Submitted points</span>
                  <span className="font-mono text-green-600">{submittedPointsCount}</span>
                </div>
              </div>
              <div className="w-full bg-muted rounded-full h-2 mt-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(submittedPointsCount / maxPointsPerGame) * 100}%` }}
                />
                <div
                  className="bg-amber-500 h-2 rounded-full transition-all duration-300 -mt-2"
                  style={{
                    width: `${((submittedPointsCount + cartSize) / maxPointsPerGame) * 100}%`,
                    marginLeft: `${(submittedPointsCount / maxPointsPerGame) * 100}%`,
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {cartSize > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Cart Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {Array.from(cartFlags).map((flagKey) => {
                  const parts = flagKey.split("-")
                  const [, mainX, mainY, detailX, detailY] = parts.map(Number)
                  return (
                    <div key={flagKey} className="flex items-center justify-between p-2 bg-muted/50 rounded text-xs">
                      <span className="font-mono">
                        Area ({mainX + 1},{mainY + 1}) - Point ({detailX + 1},{detailY + 1})
                      </span>
                      <Button
                        onClick={() => removeFromCart(flagKey)}
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                      >
                        ×
                      </Button>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Player Intel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {selectedMainSquare
                  ? `Reveal player positions in this area. Snapshot lasts 30 seconds.`
                  : `Reveal which areas have players. Snapshot lasts 30 seconds.`}
              </p>

              {activeSnapshot ? (
                <div className="space-y-2">
                  <Badge variant="default" className="w-full justify-center bg-cyan-500">
                    <Eye className="w-4 h-4 mr-1" />
                    {selectedMainSquare ? "Area Intel Active" : "Map Intel Active"}
                  </Badge>
                  <p className="text-xs text-center text-muted-foreground">
                    Showing {selectedMainSquare ? "detailed positions" : "occupied areas"} from{" "}
                    {new Date(
                      playerSnapshots.find((s) => s.id === activeSnapshot)?.timestamp || 0,
                    ).toLocaleTimeString()}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full bg-transparent"
                    onClick={() => setActiveSnapshot(null)}
                  >
                    Hide Snapshot
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={purchaseSnapshot}
                  disabled={playerTurns < 1}
                  className="w-full bg-cyan-600 hover:bg-cyan-700"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  {selectedMainSquare
                    ? `Reveal Area Players (${snapshotCost} ETH)`
                    : `Reveal Occupied Areas (${snapshotCost} ETH)`}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex-1 space-y-4">
        <div className="flex items-center justify-between bg-card rounded-lg p-4">
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="font-mono">
              <Timer className="w-4 h-4 mr-1" />
              {formatTime(300)} {/* Placeholder for game time left */}
            </Badge>
            <Badge variant="secondary">
              <Zap className="w-4 h-4 mr-1" />
              {playerTurns} turns left
            </Badge>
            <Badge variant="outline">
              <Flag className="w-4 h-4 mr-1" />
              {totalFlags} submitted | {cartSize} in cart
            </Badge>
            <Badge variant={selectedMainSquare ? "default" : "secondary"}>
              <Eye className="w-4 h-4 mr-1" />
              {selectedMainSquare
                ? `Detail View (${selectedMainSquare.x + 1},${selectedMainSquare.y + 1})`
                : "Main View (4x4)"}
            </Badge>
            {activeSnapshot && (
              <Badge variant="default" className="bg-cyan-500">
                <Eye className="w-4 h-4 mr-1" />
                Intel Active
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            {selectedMainSquare && (
              <Button variant="outline" size="sm" onClick={() => setSelectedMainSquare(null)}>
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back to Main
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleZoomOut} disabled={zoomLevel <= minZoom}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-sm text-muted-foreground min-w-[60px] text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <Button variant="outline" size="sm" onClick={handleZoomIn} disabled={zoomLevel >= maxZoom}>
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setZoomLevel(1)
                setMapPosition({ x: 0, y: 0 })
              }}
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="relative bg-card rounded-lg p-4 overflow-hidden">
          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            onClick={handleCanvasClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className={`border border-border/50 rounded-lg mx-auto block ${
              selectedMainSquare ? (playerTurns > 0 ? "cursor-crosshair" : "cursor-not-allowed") : "cursor-pointer"
            } ${isDragging ? "cursor-grabbing" : ""}`}
            style={{
              maxWidth: "100%",
              height: "auto",
            }}
          />

          <div className="absolute top-4 right-4 text-xs text-muted-foreground bg-muted/80 rounded px-2 py-1">
            Buenos Aires Map | {selectedMainSquare ? "Add to Cart" : "Select Area"} | Zoom:{" "}
            {Math.round(zoomLevel * 100)}%
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">
              {selectedMainSquare
                ? `Exploring Area (${selectedMainSquare.x + 1},${selectedMainSquare.y + 1})`
                : "Map Overview"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Flags Placed</span>
                <span className="font-mono text-lg">{totalFlags}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-accent h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min((totalFlags / 20) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedMainSquare
                  ? "Click on the 4x4 grid to place flags with your turns. Each flag marks a potential treasure location."
                  : "Click on any of the 16 main squares to explore that area in detail. Each square contains a 4x4 grid for flag placement."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

const mockGameData = {
  playersNeeded: 6,
  currentPlayers: 3,
  gameStartsIn: 120, // seconds
  playerTurns: 5,
  mapSize: "50x50",
  prizePool: "0.5 ETH",
}

export default function TreasureHuntGame() {
  const { isConnected, address, isConnecting, connectWallet, disconnectWallet } = useWallet()
  const [gameTimer, setGameTimer] = useState(mockGameData.gameStartsIn)
  const [gameState, setGameState] = useState<"lobby" | "playing">("lobby")
  const [playerTurns, setPlayerTurns] = useState(mockGameData.playerTurns)

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center">
              <MapPin className="w-6 h-6 text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Treasure Hunt</h1>
              <p className="text-sm text-muted-foreground">Base Miniapp</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {isConnected && (
              <Badge variant="secondary" className="px-3 py-1">
                <Wallet className="w-4 h-4 mr-2" />
                {address}
              </Badge>
            )}
            <Button
              onClick={isConnected ? disconnectWallet : connectWallet}
              disabled={isConnecting}
              variant={isConnected ? "outline" : "default"}
              className="min-w-[140px]"
            >
              {isConnecting ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                  Connecting...
                </>
              ) : isConnected ? (
                <>
                  <Wallet className="w-4 h-4 mr-2" />
                  Disconnect
                </>
              ) : (
                <>
                  <Wallet className="w-4 h-4 mr-2" />
                  Connect Wallet
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {!isConnected ? (
          <div className="max-w-md mx-auto">
            <Card className="text-center">
              <CardHeader>
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Wallet className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-2xl">Connect Your Wallet</CardTitle>
                <CardDescription>
                  Connect your Base or MetaMask wallet to join the treasure hunt adventure
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={connectWallet} disabled={isConnecting} className="w-full" size="lg">
                  {isConnecting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Wallet className="w-5 h-5 mr-2" />
                      Connect Wallet
                    </>
                  )}
                </Button>
                <p className="text-sm text-muted-foreground">
                  Supports MetaMask, Coinbase Wallet, and other Base-compatible wallets
                </p>
              </CardContent>
            </Card>
          </div>
        ) : gameState === "playing" ? (
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold text-foreground mb-2">The Hunt Begins!</h2>
              <p className="text-muted-foreground">Click on the map to place your marks and find the hidden treasure</p>
            </div>

            <TreasureMap
              playerTurns={playerTurns}
              onTurnUsed={handleTurnUsed}
              onBuyTurns={handleBuyTurns}
              onTurnsChanged={handleTurnsChanged}
            />
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-foreground mb-2">Welcome to the Hunt!</h2>
              <p className="text-muted-foreground">Join other treasure hunters in an epic multiplayer adventure</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
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
                    <span className="text-sm text-muted-foreground">Game starts in</span>
                    <Badge variant="outline" className="font-mono">
                      <Timer className="w-4 h-4 mr-1" />
                      {formatTime(gameTimer)}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Prize Pool</span>
                    <Badge variant="secondary" className="text-accent">
                      <Coins className="w-4 h-4 mr-1" />
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
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    Game Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Map Size</span>
                      <Badge variant="outline">{mockGameData.mapSize}</Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Your Turns</span>
                      <Badge variant="secondary">
                        <Zap className="w-4 h-4 mr-1" />
                        {mockGameData.playerTurns}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">How to Play:</p>
                      <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                        <li>Use turns to place X marks on the map</li>
                        <li>Zoom in/out to explore different areas</li>
                        <li>Buy more turns with your wallet</li>
                        <li>First to find the treasure wins!</li>
                      </ul>
                    </div>

                    <Button variant="outline" className="w-full bg-transparent">
                      <Coins className="w-4 h-4 mr-2" />
                      Buy More Turns
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Connected Players</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  {Array.from({ length: mockGameData.currentPlayers }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                        <span className="text-xs font-medium">P{i + 1}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        0x{Math.random().toString(16).substr(2, 4)}...
                      </span>
                    </div>
                  ))}
                  {Array.from({ length: mockGameData.playersNeeded - mockGameData.currentPlayers }).map((_, i) => (
                    <div key={`empty-${i}`} className="flex items-center gap-2 opacity-50">
                      <div className="w-8 h-8 border-2 border-dashed border-muted rounded-full flex items-center justify-center">
                        <span className="text-xs">?</span>
                      </div>
                      <span className="text-sm text-muted-foreground">Waiting...</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}
