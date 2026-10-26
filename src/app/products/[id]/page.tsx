import { ProductDetailView } from "./product-detail-content";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ProductDetailPage({ params }: PageProps) {
  return <ProductDetailView params={params} />;
}
