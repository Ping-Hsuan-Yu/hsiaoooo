export type ProjectImage = {
  id: string
  src: string
  order: number
  tags: string[]
}

export const projectTags = [
  '社群專案',
  '廣告Banner',
  '一頁式Landing page',
  '動畫製作',
  '插畫設計',
  '視覺設計',
  '商品攝影'
]

const files = [
  'alexander-jawfox-zd9Y8NhZixM-unsplash.jpg',
  'altumcode-RrFvYtCwO8E-unsplash.jpg',
  'andrew-bui-z7rzbFHXym0-unsplash.jpg',
  'daniel-stiel-eWVBPrp_L1c-unsplash.jpg',
  'farhat-altaf-5vDkOVO-rHM-unsplash.jpg',
  'farhat-altaf-S-5NzAmEHpg-unsplash.jpg',
  'fer-nando-45JXWRNoTqU-unsplash.jpg',
  'fons-heijnsbroek-Op5oaQcYhPA-unsplash.jpg',
  'frank-weichelt-KeGnpW8cmak-unsplash.jpg',
  'frank-weichelt-PtTGcFyGYNQ-unsplash.jpg',
  'frank-weichelt-UR3KtanOq5o-unsplash.jpg',
  'frank-weichelt-YZzR5V2Um7I-unsplash.jpg',
  'frank-weichelt-jmdJam0X7u0-unsplash.jpg',
  'hanna-plants-6QFM_X9kJog-unsplash.jpg',
  'hanna-plants-NZKi1w7HUcM-unsplash.jpg',
  'hanna-plants-UPVakqefBwM-unsplash.jpg',
  'hanna-plants-Zf2nOR3dFQo-unsplash.jpg',
  'ishan-seefromthesky-TobZaa8ZwI4-unsplash.jpg',
  'jay-antol-Xbf_4e7YDII-unsplash.jpg',
  'karolis-milisauskas-3Ruy7rRNevY-unsplash.jpg',
  'karolis-milisauskas-GqQvtUA3dvw-unsplash.jpg',
  'karsten-winegeart-L3PhYz2ewJk-unsplash.jpg',
  'karsten-winegeart-zv2dekejUzE-unsplash.jpg',
  'kenrick-mills-l2T9cWjH9cY-unsplash.jpg',
  'kitera-dent-z4ky2zXIjDM-unsplash.jpg',
  'kyle-johnson-TEZZzuQTt8g-unsplash.jpg',
  'mohamed-nohassi-odxB5oIG_iA-unsplash.jpg',
  'saad-chaudhry-cYpqYxGeqts-unsplash.jpg',
  'sam-moghadam-CG4kIVf-Mwk-unsplash.jpg',
  'slava-denisov-Qu-aZD3MsNM-unsplash.jpg',
  'taryn-kaahanui-J5b23iaAHis-unsplash.jpg'
]

export const dummyProjects: ProjectImage[] = files.map((file, index) => {
  // Use deterministic combinations based on index to avoid hydration mismatch
  const tag1 = projectTags[index % projectTags.length]
  const tag2 = projectTags[(index + 3) % projectTags.length]

  const selectedTags = Array.from(new Set([tag1, tag2]))

  return {
    id: `project_${index}`,
    src: `/images/projects/${file}`,
    order: index,
    tags: selectedTags
  }
})
