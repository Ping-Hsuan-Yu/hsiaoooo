'use client'

import { useEffect, useRef, useState } from 'react'

// 拖曳過程只更新畫面順序，放手才寫回 server（避免每次交換都打 API）
export function useReorderList<T extends { id: string }>(
  initialItems: T[],
  reorderAction: (orderedIds: string[]) => Promise<void>,
  onReordered: () => void
) {
  const [items, setItems] = useState(initialItems)
  const itemsRef = useRef(items)
  itemsRef.current = items

  // server 重新驗證後同步最新資料
  useEffect(() => setItems(initialItems), [initialItems])

  const persistOrder = () => {
    reorderAction(itemsRef.current.map(item => item.id)).then(onReordered)
  }

  return { items, setItems, persistOrder }
}
