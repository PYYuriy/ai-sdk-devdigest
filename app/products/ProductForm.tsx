'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { addProduct, type AddProductState } from './actions';

const initialState: AddProductState = { status: 'idle', message: '' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
    >
      {pending ? 'Saving…' : 'Add product'}
    </button>
  );
}

function Field({
  label,
  name,
  type = 'text',
  errors,
  ...rest
}: {
  label: string;
  name: string;
  type?: string;
  errors?: string[];
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <input
        name={name}
        type={type}
        required
        className="rounded border border-zinc-300 px-3 py-2 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
        {...rest}
      />
      {errors?.length ? (
        <span className="text-xs text-red-600">{errors[0]}</span>
      ) : null}
    </label>
  );
}

export default function ProductForm() {
  const [state, formAction] = useActionState(addProduct, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="Product name" name="name" errors={state.errors?.name} />
      <Field label="Country" name="country" errors={state.errors?.country} />
      <Field
        label="Price"
        name="price"
        type="number"
        step="0.01"
        min="0"
        errors={state.errors?.price}
      />
      <Field label="Size" name="size" errors={state.errors?.size} />
      <Field
        label="Amount"
        name="amount"
        type="number"
        step="1"
        min="0"
        errors={state.errors?.amount}
      />

      <SubmitButton />

      {state.status !== 'idle' && state.message ? (
        <p
          role="status"
          className={
            state.status === 'success'
              ? 'text-sm text-green-600'
              : 'text-sm text-red-600'
          }
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
