import ProductForm from './ProductForm';

export const metadata = {
  title: 'Add Product',
};

export default function ProductsPage() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <h1 className="mb-1 text-2xl font-semibold">Add a product</h1>
      <p className="mb-6 text-sm text-zinc-500">
        Fill in the details below. On submit the product is saved to the SQLite
        database.
      </p>
      <ProductForm />
    </div>
  );
}
