"use client"

import { Button } from "@/components/ui/button"
import type React from "react"
import { useState, useRef } from "react"
import { ZoomOut, ZoomIn, Eye } from "lucide-react"

interface TreasureMapProps {
  playerTurns: number
  onTurnUsed: () => void
  onBuyTurns: () => void
  onTurnsChanged: (turns: number) => void
}

const TreasureMap: React.FC<TreasureMapProps> = ({ playerTurns, onTurnUsed, onBuyTurns, onTurnsChanged }) => {
  const [zoomLevel, setZoomLevel] = useState(1)
  const minZoom = 0.5
  const maxZoom = 2
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [activeSnapshot, setActiveSnapshot] = useState(false)
  const snapshotTimeLeft = 60000 // Example value for snapshot time left in milliseconds
  const [selectedMainSquare, setSelectedMainSquare] = useState(false)

  const handleZoomOut = () => {
    if (zoomLevel > minZoom) {
      setZoomLevel(zoomLevel - 0.1)
    }
  }

  const handleZoomIn = () => {
    if (zoomLevel < maxZoom) {
      setZoomLevel(zoomLevel + 0.1)
    }
  }

  const purchaseSnapshot = () => {
    if (playerTurns >= 1) {
      onTurnUsed()
      setActiveSnapshot(true)
    }
  }

  const handleCanvasClick = () => {
    setSelectedMainSquare(!selectedMainSquare)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <div className="bg-white/90 backdrop-blur-sm rounded-lg p-2 flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleZoomOut}
            disabled={zoomLevel <= minZoom}
            className="h-8 w-8 p-0"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-xs text-muted-foreground min-w-[40px] text-center">{Math.round(zoomLevel * 100)}%</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleZoomIn}
            disabled={zoomLevel >= maxZoom}
            className="h-8 w-8 p-0"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
        </div>

        <Button
          onClick={purchaseSnapshot}
          disabled={playerTurns < 1}
          variant="secondary"
          size="sm"
          className="bg-white/90 backdrop-blur-sm text-xs px-3 py-2"
        >
          <Eye className="w-3 h-3 mr-1" />
          Intel (0.005 ETH)
        </Button>

        {activeSnapshot && (
          <div className="bg-cyan-500/90 backdrop-blur-sm rounded-lg p-2 text-white text-xs text-center">
            <Eye className="w-3 h-3 mx-auto mb-1" />
            Intel Active
            <div className="text-xs opacity-80">{Math.ceil(snapshotTimeLeft / 1000)}s left</div>
          </div>
        )}
      </div>

      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="w-full h-full touch-none"
        style={{
          imageRendering: "pixelated",
          cursor: selectedMainSquare ? "crosshair" : "pointer",
        }}
        onClick={handleCanvasClick}
        onTouchStart={handleCanvasClick}
      />
    </div>
  )
}
