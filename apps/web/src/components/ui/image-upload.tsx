'use client'

import React, { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

interface ImageUploadProps {
  value?: string | null
  onChange: (url: string) => void
  onRemove?: () => void
  label?: string
  endpoint?: string
  className?: string
  aspectRatio?: 'square' | 'video' | 'wide'
  placeholder?: string
}

export function ImageUpload({
  value, onChange, onRemove, label,
  endpoint = '/upload/image',
  className, aspectRatio = 'wide', placeholder,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const aspectClasses = {
    square: 'aspect-square',
    video: 'aspect-video',
    wide: 'aspect-[16/7]',
  }[aspectRatio]

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('กรุณาเลือกไฟล์รูปภาพเท่านั้น')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('ขนาดไฟล์ต้องไม่เกิน 10MB')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      onChange(res.data.url)
      toast.success('อัปโหลดรูปภาพสำเร็จ')
    } catch (err) {
      toast.error('อัปโหลดไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setUploading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleUpload(file)
  }

  return (
    <div className={cn('w-full', className)}>
      {label && <label className="mb-1.5 block text-sm font-medium text-stone-300">{label}</label>}

      <div
        className={cn('relative overflow-hidden rounded-2xl border-2 transition-all duration-200 cursor-pointer', aspectClasses,
          dragOver
            ? 'border-amber-400/60 bg-amber-400/10'
            : value
            ? 'border-white/15 bg-transparent'
            : 'border-dashed border-white/20 bg-white/[0.03] hover:border-amber-400/40 hover:bg-amber-400/5'
        )}
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {/* Image preview */}
        <AnimatePresence>
          {value && (
            <motion.img
              src={value}
              alt="Preview"
              className="absolute inset-0 h-full w-full object-cover"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
          )}
        </AnimatePresence>

        {/* Overlay when has image */}
        {value && (
          <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="text-xs font-medium text-white bg-black/50 rounded-lg px-3 py-1.5">เปลี่ยนรูปภาพ</div>
          </div>
        )}

        {/* Upload state */}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 text-amber-400 animate-spin" />
              <span className="text-xs text-stone-300">กำลังอัปโหลด...</span>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!value && !uploading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-stone-600">
            <div className={cn('flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.05]', dragOver ? 'border-amber-400/40' : '')}>
              <Upload className="m-3 h-6 w-6" />
            </div>
            <div className="text-xs text-center">
              <span className="text-amber-400 font-medium">คลิกเพื่ออัปโหลด</span> หรือลากไฟล์มาวาง
            </div>
            {placeholder && <span className="text-xs text-stone-600">{placeholder}</span>}
            <span className="text-xs">JPEG, PNG, WebP สูงสุด 10MB</span>
          </div>
        )}
      </div>

      {/* Remove button */}
      {value && onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          className="mt-2 flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
          ลบรูปภาพ
        </button>
      )}

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
    </div>
  )
}

// Multiple image upload component
interface MultiImageUploadProps {
  images: { id?: string; url: string; isPrimary?: boolean }[]
  onAdd: (url: string) => void
  onRemove: (index: number) => void
  onSetPrimary: (index: number) => void
  label?: string
  maxImages?: number
}

export function MultiImageUpload({ images, onAdd, onRemove, onSetPrimary, label, maxImages = 8 }: MultiImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (file: File) => {
    if (images.length >= maxImages) { toast.error(`อัปโหลดได้สูงสุด ${maxImages} รูป`); return }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.post('/upload/room-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      onAdd(res.data.url)
      toast.success('อัปโหลดรูปภาพสำเร็จ')
    } catch {
      toast.error('อัปโหลดไม่สำเร็จ')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      {label && <label className="mb-2 block text-sm font-medium text-stone-300">{label}</label>}
      <div className="flex flex-wrap gap-3">
        {images.map((img, i) => (
          <div key={i} className="relative group h-24 w-32 rounded-xl overflow-hidden border border-white/15">
            <img src={img.url} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
              <button onClick={() => onSetPrimary(i)}
                className={cn('rounded-lg px-2 py-1 text-xs font-medium transition-colors', img.isPrimary ? 'bg-amber-400 text-stone-900' : 'bg-white/20 text-white hover:bg-amber-400/80 hover:text-stone-900')}>
                {img.isPrimary ? '★ หลัก' : 'ตั้งหลัก'}
              </button>
              <button onClick={() => onRemove(i)} className="rounded-lg bg-rose-500/80 p-1 hover:bg-rose-400">
                <X className="h-3 w-3 text-white" />
              </button>
            </div>
            {img.isPrimary && (
              <div className="absolute top-1 left-1 rounded-full bg-amber-400 px-1.5 py-0.5 text-xs font-bold text-stone-900">หลัก</div>
            )}
          </div>
        ))}

        {images.length < maxImages && (
          <button
            onClick={() => inputRef.current?.click()}
            className="flex h-24 w-32 items-center justify-center rounded-xl border-2 border-dashed border-white/20 bg-white/[0.03] text-stone-600 hover:border-amber-400/40 hover:text-amber-400 hover:bg-amber-400/5 transition-all"
          >
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = '' }} />
    </div>
  )
}
