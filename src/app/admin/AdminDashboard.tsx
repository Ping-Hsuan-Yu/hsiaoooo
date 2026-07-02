'use client'

import { useState } from 'react'
import { type Project, type ProjectCategoryWithUsage, type PricingItem } from '@/lib/projects'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { logoutAction } from './actions'
import { Button } from '@/components/ui/button'
import ProjectsTab from './ProjectsTab'
import CategoriesTab from './CategoriesTab'
import PricingTab from './PricingTab'

export default function AdminDashboard({
  initialProjects,
  initialCategories,
  initialPricing
}: {
  initialProjects: Project[]
  initialCategories: ProjectCategoryWithUsage[]
  initialPricing: PricingItem[]
}) {
  const [tab, setTab] = useState('projects')

  return (
    <div className='mx-auto max-w-5xl px-4 py-10'>
      <div className='mb-8 flex items-center justify-between'>
        <h1 className='text-3xl font-bold'>作品後台</h1>
        <form action={logoutAction}>
          <Button type='submit' variant='outline' className='rounded-full'>
            登出
          </Button>
        </form>
      </div>

      <Tabs value={tab} onValueChange={value => setTab(String(value))}>
        <TabsList variant='line' className='mb-8'>
          <TabsTrigger value='projects'>作品</TabsTrigger>
          <TabsTrigger value='categories'>分類</TabsTrigger>
          <TabsTrigger value='pricing'>定價</TabsTrigger>
        </TabsList>
        <TabsContent value='projects'>
          <ProjectsTab initialProjects={initialProjects} />
        </TabsContent>
        <TabsContent value='categories'>
          <CategoriesTab initialCategories={initialCategories} />
        </TabsContent>
        <TabsContent value='pricing'>
          <PricingTab initialPricing={initialPricing} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
