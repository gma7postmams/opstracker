"use client";
import Modal from "./Modal";

export default function ConfirmDialog({ title, body, onYes, onCancel }: {
  title: string; body: string; onYes: () => void; onCancel: () => void;
}) {
  return (
    <Modal title={title} subtitle={body} onClose={onCancel} width={430}
      footer={<>
        <button className="secondary" onClick={onCancel}>Cancel</button>
        <button className="primary destructive" onClick={onYes}>Confirm</button>
      </>}>
      <></>
    </Modal>
  );
}
