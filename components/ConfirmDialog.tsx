"use client";

import Modal from "./Modal";

export default function ConfirmDialog({
  title,
  body,
  onYes,
  onCancel,
  yesText = "Confirm",
  noText = "Cancel",
}: {
  title: string;
  body: string;
  onYes: () => void;
  onCancel: () => void;
  yesText?: string;
  noText?: string;
}) {
  return (
    <Modal
      title={title}
      subtitle={body}
      onClose={onCancel}
      width={430}
      footer={
        <>
          <button
            className="secondary"
            onClick={onCancel}
          >
            {noText}
          </button>

          <button
            className="primary"
            onClick={onYes}
          >
            {yesText}
          </button>
        </>
      }
    >
      <></>
    </Modal>
  );
}