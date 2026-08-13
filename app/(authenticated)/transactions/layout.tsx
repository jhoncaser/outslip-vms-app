import { TransactionLiveUpdates } from "@/components/dashboard/TransactionLiveUpdates";

export default function TransactionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <TransactionLiveUpdates />
      {children}
    </>
  );
}
