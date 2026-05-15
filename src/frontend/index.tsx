import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
} from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import React from "react";
import "./index.css";

const queryClient = new QueryClient();

interface ElizaConfig {
  agentId: string;
  apiBase: string;
}

declare global {
  interface Window {
    ELIZA_CONFIG?: ElizaConfig;
  }
}

type Community = {
  id: string;
  name: string;
  type: string;
  description?: string;
  monthlyFee: number;
  isActive: boolean;
};

type Member = {
  id: string;
  name: string;
  phone?: string;
  isActive: boolean;
};

type Invoice = {
  id: string;
  memberId: string;
  amount: number;
  description: string;
  period: string;
  dueDate: string;
  status: "pending" | "paid" | "overdue" | "cancelled";
  paymentLink?: string;
  reminderCount: number;
  paidAt?: string;
};

type KasSummary = {
  totalIncome: number;
  totalExpense: number;
  currentBalance: number;
  lastUpdated: string;
};

type KasEntry = {
  id: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  description: string;
  referenceId?: string;
  date: string;
  createdAt: string;
};

type AgentLog = {
  id: string;
  action: string;
  details: Record<string, unknown>;
  createdAt: string;
};

type FieldDef = {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "textarea";
  placeholder?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
  defaultValue?: string | number;
};

type ModalConfig = {
  title: string;
  description: string;
  icon?: React.ReactNode;
  fields: FieldDef[];
  onSubmit: (data: Record<string, any>) => Promise<void>;
};

type SummaryResponse = {
  community: Community;
  members: Member[];
  kas: KasSummary;
  kasEntries: KasEntry[];
  invoices: Invoice[];
  logs: AgentLog[];
  dokuConfigured: boolean;
};

type ActionResult = {
  error?: string;
  [key: string]: unknown;
};

const formatRupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

const formatDate = (value?: string) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
};

const apiBase = () => window.ELIZA_CONFIG?.apiBase?.replace(/\/$/, "") ?? "";

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase()}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      data?.error ?? `Request failed with status ${response.status}`,
    );
  }
  return data as T;
}

function AppShell() {
  React.useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <KomunitasDashboard />
      <ChatWidget />
    </QueryClientProvider>
  );
}

function useActionModal() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [config, setConfig] = React.useState<ModalConfig | null>(null);

  const open = React.useCallback((newConfig: ModalConfig) => {
    setConfig(newConfig);
    setIsOpen(true);
  }, []);

  const close = React.useCallback(() => {
    setIsOpen(false);
    setTimeout(() => setConfig(null), 200); // Wait for transition
  }, []);

  return { isOpen, config, open, close };
}

function ActionModal({
  isOpen,
  config,
  onClose,
}: {
  isOpen: boolean;
  config: ModalConfig | null;
  onClose: () => void;
}) {
  const [formData, setFormData] = React.useState<Record<string, any>>({});
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [apiError, setApiError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen && config) {
      const initial: Record<string, any> = {};
      config.fields.forEach((f) => {
        initial[f.key] = f.defaultValue ?? (f.type === "number" ? "" : "");
        if (f.type === "select" && f.options?.length && initial[f.key] === "") {
          initial[f.key] = f.options[0].value;
        }
      });
      setFormData(initial);
      setErrors({});
      setApiError(null);
    }
  }, [isOpen, config]);

  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen || !config) return null;

  const validate = () => {
    const newErrors: Record<string, string> = {};
    config.fields.forEach((f) => {
      if (
        f.required &&
        (formData[f.key] === undefined || formData[f.key] === "")
      ) {
        newErrors[f.key] = `${f.label} wajib diisi`;
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setApiError(null);
    try {
      await config.onSubmit(formData);
      onClose();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#172033]/50 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200 overflow-hidden rounded-xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
        <div className="border-b border-[#dce2ec] px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              {config.icon && (
                <div className="mt-1 shrink-0 text-[#255f85]">
                  {config.icon}
                </div>
              )}
              <div>
                <h2
                  id="modal-title"
                  className="text-lg font-semibold text-[#172033]"
                >
                  {config.title}
                </h2>
                <p className="mt-1 text-sm text-[#657086]">
                  {config.description}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="shrink-0 rounded-md p-1.5 text-[#657086] hover:bg-[#f7f8fa] hover:text-[#172033] transition-colors disabled:opacity-50"
              aria-label="Tutup modal"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {apiError && (
            <div className="mb-5 rounded-md bg-[#fdecec] p-3 text-sm text-[#9d2f2f] border border-[#f5c6c6]">
              {apiError}
            </div>
          )}

          <form id="action-form" onSubmit={handleSubmit} className="space-y-4">
            {config.fields.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <label
                  htmlFor={field.key}
                  className="block text-sm font-medium text-[#172033]"
                >
                  {field.label}{" "}
                  {field.required && <span className="text-[#9d2f2f]">*</span>}
                </label>

                {field.type === "select" ? (
                  <select
                    id={field.key}
                    value={formData[field.key]}
                    onChange={(e) =>
                      setFormData({ ...formData, [field.key]: e.target.value })
                    }
                    disabled={isSubmitting}
                    className={`w-full rounded-md border ${errors[field.key] ? "border-[#9d2f2f] focus:ring-[#9d2f2f]" : "border-[#cdd6e3] focus:border-[#255f85] focus:ring-[#255f85]"} bg-white px-3 py-2 text-sm text-[#172033] focus:outline-none focus:ring-1 disabled:opacity-50 disabled:bg-[#f7f8fa]`}
                  >
                    {field.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : field.type === "textarea" ? (
                  <textarea
                    id={field.key}
                    value={formData[field.key]}
                    onChange={(e) =>
                      setFormData({ ...formData, [field.key]: e.target.value })
                    }
                    disabled={isSubmitting}
                    placeholder={field.placeholder}
                    rows={3}
                    className={`w-full rounded-md border ${errors[field.key] ? "border-[#9d2f2f] focus:ring-[#9d2f2f]" : "border-[#cdd6e3] focus:border-[#255f85] focus:ring-[#255f85]"} bg-white px-3 py-2 text-sm text-[#172033] focus:outline-none focus:ring-1 disabled:opacity-50 disabled:bg-[#f7f8fa] resize-none`}
                  />
                ) : (
                  <input
                    id={field.key}
                    type={field.type}
                    value={formData[field.key]}
                    onChange={(e) => {
                      const val =
                        field.type === "number"
                          ? e.target.value === ""
                            ? ""
                            : Number(e.target.value)
                          : e.target.value;
                      setFormData({ ...formData, [field.key]: val });
                    }}
                    disabled={isSubmitting}
                    placeholder={field.placeholder}
                    className={`w-full rounded-md border ${errors[field.key] ? "border-[#9d2f2f] focus:ring-[#9d2f2f]" : "border-[#cdd6e3] focus:border-[#255f85] focus:ring-[#255f85]"} bg-white px-3 py-2 text-sm text-[#172033] focus:outline-none focus:ring-1 disabled:opacity-50 disabled:bg-[#f7f8fa]`}
                  />
                )}

                {errors[field.key] && (
                  <p className="text-xs text-[#9d2f2f]">{errors[field.key]}</p>
                )}
              </div>
            ))}
          </form>
        </div>

        <div className="border-t border-[#dce2ec] bg-[#f7f8fa] px-6 py-4 flex justify-end gap-3 shrink-0">
          <ActionButton
            variant="secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Batal
          </ActionButton>
          <ActionButton
            onClick={() => {
              const form = document.getElementById(
                "action-form",
              ) as HTMLFormElement;
              form.requestSubmit();
            }}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Memproses...
              </span>
            ) : (
              "Simpan & Lanjutkan"
            )}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

function OnboardingModal({
  isOpen,
  onSuccess,
}: {
  isOpen: boolean;
  onSuccess: () => void;
}) {
  const [step, setStep] = React.useState(1);
  const [communityType, setCommunityType] = React.useState("RT/RW");
  const [communityData, setCommunityData] = React.useState({
    name: "",
    description: "",
    monthlyFee: "",
  });
  const [memberData, setMemberData] = React.useState({
    name: "",
    phone: "",
    address: "",
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [apiError, setApiError] = React.useState<string | null>(null);

  if (!isOpen) return null;

  const communityTypes = [
    {
      id: "RT/RW",
      icon: "🏘️",
      title: "RT/RW",
      desc: "Iuran warga dan kas lingkungan",
    },
    {
      id: "Arisan",
      icon: "👥",
      title: "Arisan",
      desc: "Kelola setoran dan kocokan bulanan",
    },
    {
      id: "Koperasi",
      icon: "🤝",
      title: "Koperasi",
      desc: "Simpan pinjam skala kecil",
    },
    {
      id: "Event",
      icon: "🎟️",
      title: "Event",
      desc: "Patungan acara atau kepanitiaan",
    },
    {
      id: "Lainnya",
      icon: "✨",
      title: "Lainnya",
      desc: "Komunitas umum lainnya",
    },
  ];

  const handleSetup = async () => {
    setIsSubmitting(true);
    setApiError(null);
    try {
      await requestJson("/api/v1/komunitas/setup", {
        method: "POST",
        body: JSON.stringify({
          type: communityType,
          name: communityData.name,
          description: communityData.description,
          monthlyFee: Number(communityData.monthlyFee) || 0,
        }),
      });

      await requestJson("/api/v1/komunitas/members", {
        method: "POST",
        body: JSON.stringify({
          name: memberData.name,
          phone: memberData.phone,
          address: memberData.address,
        }),
      });

      setStep(4);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#172033]/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        {step === 1 && (
          <div className="p-8">
            <h2 className="text-2xl font-bold text-[#172033]">
              Selamat datang di KomunitasAI
            </h2>
            <p className="mt-2 text-sm text-[#657086]">
              Mari siapkan bendahara digital untuk komunitas Anda. Pertama,
              pilih jenis komunitas:
            </p>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {communityTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setCommunityType(type.id)}
                  className={`flex flex-col items-start p-4 rounded-xl border-2 text-left transition-all ${communityType === type.id ? "border-[#255f85] bg-[#f0f6fa]" : "border-[#dce2ec] hover:border-[#cdd6e3] hover:bg-[#f7f8fa]"}`}
                >
                  <span className="text-2xl mb-2">{type.icon}</span>
                  <span className="font-semibold text-[#172033]">
                    {type.title}
                  </span>
                  <span className="text-xs text-[#657086] mt-1">
                    {type.desc}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-8 flex justify-end">
              <ActionButton onClick={() => setStep(2)}>
                Selanjutnya
              </ActionButton>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="p-8">
            <h2 className="text-xl font-bold text-[#172033]">
              Detail Komunitas
            </h2>
            <p className="mt-2 text-sm text-[#657086]">
              Lengkapi informasi dasar komunitas {communityType} Anda.
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#172033] mb-1">
                  Nama Komunitas <span className="text-[#9d2f2f]">*</span>
                </label>
                <input
                  type="text"
                  value={communityData.name}
                  onChange={(e) =>
                    setCommunityData({ ...communityData, name: e.target.value })
                  }
                  className="w-full rounded-md border border-[#cdd6e3] bg-white px-3 py-2 text-sm focus:border-[#255f85] focus:outline-none focus:ring-1 focus:ring-[#255f85]"
                  placeholder={`Contoh: ${communityType === "RT/RW" ? "RT 01 / RW 02 Mawar" : "Arisan Keluarga"}`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#172033] mb-1">
                  Deskripsi / Alamat
                </label>
                <textarea
                  value={communityData.description}
                  onChange={(e) =>
                    setCommunityData({
                      ...communityData,
                      description: e.target.value,
                    })
                  }
                  className="w-full rounded-md border border-[#cdd6e3] bg-white px-3 py-2 text-sm focus:border-[#255f85] focus:outline-none focus:ring-1 focus:ring-[#255f85] resize-none"
                  rows={2}
                  placeholder="Opsional"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#172033] mb-1">
                  Nominal Iuran Bulanan Default (Rp){" "}
                  <span className="text-[#9d2f2f]">*</span>
                </label>
                <input
                  type="number"
                  value={communityData.monthlyFee}
                  onChange={(e) =>
                    setCommunityData({
                      ...communityData,
                      monthlyFee: e.target.value,
                    })
                  }
                  className="w-full rounded-md border border-[#cdd6e3] bg-white px-3 py-2 text-sm focus:border-[#255f85] focus:outline-none focus:ring-1 focus:ring-[#255f85]"
                  placeholder="Contoh: 50000"
                />
              </div>
            </div>

            <div className="mt-8 flex justify-between">
              <ActionButton variant="secondary" onClick={() => setStep(1)}>
                Kembali
              </ActionButton>
              <ActionButton
                onClick={() => setStep(3)}
                disabled={!communityData.name || !communityData.monthlyFee}
              >
                Selanjutnya
              </ActionButton>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="p-8">
            <h2 className="text-xl font-bold text-[#172033]">
              Tambah Anggota Pertama
            </h2>
            <p className="mt-2 text-sm text-[#657086]">
              Mari masukkan data anggota pertama (bisa pengurus atau anggota).
            </p>

            {apiError && (
              <div className="mt-4 rounded-md bg-[#fdecec] p-3 text-sm text-[#9d2f2f] border border-[#f5c6c6]">
                {apiError}
              </div>
            )}

            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#172033] mb-1">
                  Nama Lengkap <span className="text-[#9d2f2f]">*</span>
                </label>
                <input
                  type="text"
                  value={memberData.name}
                  onChange={(e) =>
                    setMemberData({ ...memberData, name: e.target.value })
                  }
                  disabled={isSubmitting}
                  className="w-full rounded-md border border-[#cdd6e3] bg-white px-3 py-2 text-sm focus:border-[#255f85] focus:outline-none focus:ring-1 focus:ring-[#255f85] disabled:bg-[#f7f8fa]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#172033] mb-1">
                  Nomor WhatsApp <span className="text-[#9d2f2f]">*</span>
                </label>
                <input
                  type="text"
                  value={memberData.phone}
                  onChange={(e) =>
                    setMemberData({ ...memberData, phone: e.target.value })
                  }
                  disabled={isSubmitting}
                  className="w-full rounded-md border border-[#cdd6e3] bg-white px-3 py-2 text-sm focus:border-[#255f85] focus:outline-none focus:ring-1 focus:ring-[#255f85] disabled:bg-[#f7f8fa]"
                  placeholder="Contoh: 081234567890"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#172033] mb-1">
                  Alamat / Keterangan
                </label>
                <input
                  type="text"
                  value={memberData.address}
                  onChange={(e) =>
                    setMemberData({ ...memberData, address: e.target.value })
                  }
                  disabled={isSubmitting}
                  className="w-full rounded-md border border-[#cdd6e3] bg-white px-3 py-2 text-sm focus:border-[#255f85] focus:outline-none focus:ring-1 focus:ring-[#255f85] disabled:bg-[#f7f8fa]"
                  placeholder="Opsional"
                />
              </div>
            </div>

            <div className="mt-8 flex justify-between">
              <ActionButton
                variant="secondary"
                onClick={() => setStep(2)}
                disabled={isSubmitting}
              >
                Kembali
              </ActionButton>
              <ActionButton
                onClick={handleSetup}
                disabled={!memberData.name || !memberData.phone || isSubmitting}
              >
                {isSubmitting ? "Menyiapkan..." : "Selesai & Simpan"}
              </ActionButton>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#e6f4ed] text-3xl text-[#236247]">
              ✓
            </div>
            <h2 className="mt-6 text-2xl font-bold text-[#172033]">
              Siap Digunakan!
            </h2>
            <p className="mt-2 text-[#657086]">
              KomunitasAI sudah siap. Anda sekarang bisa mulai menagih iuran,
              mencatat kas, dan menggunakan AI Assistant.
            </p>
            <div className="mt-8">
              <ActionButton onClick={onSuccess}>
                Mulai Gunakan Dashboard
              </ActionButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function KomunitasDashboard() {
  const [lastAction, setLastAction] = React.useState<string>("");
  const {
    isOpen: isActionModalOpen,
    config: actionModalConfig,
    open: openActionModal,
    close: closeActionModal,
  } = useActionModal();
  const summaryQuery = useQuery({
    queryKey: ["komunitas-summary"],
    queryFn: () => requestJson<SummaryResponse>("/api/v1/komunitas/summary"),
    refetchInterval: 15000,
  });

  const actionMutation = useMutation({
    mutationFn: async ({
      path,
      label,
      body = "{}",
    }: {
      path: string;
      label: string;
      body?: string;
    }) => {
      setLastAction(`${label} sedang diproses...`);
      const result = await requestJson<ActionResult>(path, {
        method: "POST",
        body,
      });
      return { label, result };
    },
    onSuccess: ({ label }) => {
      setLastAction(`${label} selesai.`);
      void summaryQuery.refetch();
    },
    onError: (error, variables) => {
      setLastAction(
        `${variables.label} gagal: ${error instanceof Error ? error.message : String(error)}`,
      );
    },
  });

  if (summaryQuery.isLoading) {
    return <LoadingState />;
  }

  const isNeedsOnboarding =
    summaryQuery.isError ||
    !summaryQuery.data ||
    !summaryQuery.data.community?.id;

  if (isNeedsOnboarding) {
    return (
      <>
        <main className="min-h-screen bg-[#f7f8fa] p-6 text-[#172033]">
          <div className="mx-auto max-w-5xl rounded-lg border border-[#d7dde8] bg-white p-6">
            <h1 className="text-xl font-semibold">
              Dashboard belum bisa dimuat
            </h1>
            <p className="mt-2 text-sm text-[#657086]">
              {summaryQuery.error instanceof Error
                ? summaryQuery.error.message
                : "Pastikan ElizaOS server berjalan dan plugin KomunitasAI aktif."}
            </p>
          </div>
        </main>
        <OnboardingModal
          isOpen={true}
          onSuccess={() => void summaryQuery.refetch()}
        />
      </>
    );
  }

  const {
    community,
    members,
    kas,
    kasEntries,
    invoices,
    logs,
    dokuConfigured,
  } = summaryQuery.data;
  const memberById = new Map(members.map((member) => [member.id, member]));
  const paid = invoices.filter((invoice) => invoice.status === "paid");
  const pending = invoices.filter((invoice) => invoice.status === "pending");
  const overdue = invoices.filter((invoice) => invoice.status === "overdue");
  const totalInvoiceAmount = invoices.reduce(
    (sum, invoice) => sum + invoice.amount,
    0,
  );
  const paidAmount = paid.reduce((sum, invoice) => sum + invoice.amount, 0);
  const collectionRate =
    invoices.length === 0
      ? 0
      : Math.round((paid.length / invoices.length) * 100);

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-[#172033]">
      <section className="border-b border-[#dce2ec] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-[#33658a]">
              KomunitasAI
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-[#172033]">
              {community.name}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-[#657086]">
              Dashboard bendahara untuk iuran, DOKU Checkout, kas, reminder, dan
              laporan komunitas.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton
              disabled={actionMutation.isPending}
              onClick={() =>
                actionMutation.mutate({
                  path: "/api/v1/komunitas/billing/bulk",
                  label: "Buat tagihan DOKU",
                })
              }
            >
              Tagih Bulan Ini
            </ActionButton>
            <ActionButton
              disabled={actionMutation.isPending}
              variant="secondary"
              onClick={() =>
                actionMutation.mutate({
                  path: "/api/v1/komunitas/payments/check",
                  label: "Cek status pembayaran",
                })
              }
            >
              Cek Pembayaran
            </ActionButton>
            <ActionButton
              disabled={actionMutation.isPending || pending.length === 0}
              variant="secondary"
              onClick={() =>
                actionMutation.mutate({
                  path: "/api/v1/komunitas/payments/simulate",
                  label: "Simulasi pembayaran",
                })
              }
            >
              Simulasi Bayar
            </ActionButton>
            <ActionButton
              disabled={actionMutation.isPending || pending.length === 0}
              variant="secondary"
              onClick={() =>
                actionMutation.mutate({
                  path: "/api/v1/komunitas/reminders/send",
                  label: "Kirim reminder",
                })
              }
            >
              Kirim Reminder
            </ActionButton>
            <ActionButton
              disabled={actionMutation.isPending}
              variant="secondary"
              onClick={() =>
                actionMutation.mutate({
                  path: "/api/v1/komunitas/reports/current",
                  label: "Buat laporan",
                })
              }
            >
              Buat Laporan
            </ActionButton>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-5 py-5 md:grid-cols-2 xl:grid-cols-4">
        <Metric
          title="Saldo kas"
          value={formatRupiah(kas.currentBalance)}
          detail="Total saldo berjalan"
          tone="green"
        />
        <Metric
          title="Terkumpul"
          value={formatRupiah(paidAmount)}
          detail={`${paid.length} invoice lunas`}
          tone="blue"
        />
        <Metric
          title="Belum bayar"
          value={formatRupiah(totalInvoiceAmount - paidAmount)}
          detail={`${pending.length} invoice pending`}
          tone="amber"
        />
        <Metric
          title="Collection rate"
          value={`${collectionRate}%`}
          detail={`${overdue.length} invoice overdue`}
          tone="red"
        />
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-5 pb-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Panel>
            <div className="flex flex-col gap-3 border-b border-[#e2e7ef] pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Status Pembayaran</h2>
                <p className="text-sm text-[#657086]">
                  Invoice iuran periode berjalan.
                </p>
              </div>
              <StatusBadge active={dokuConfigured} />
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#e2e7ef] text-left text-xs uppercase tracking-wide text-[#657086]">
                    <th className="py-3 pr-4 font-semibold">Anggota</th>
                    <th className="py-3 pr-4 font-semibold">Periode</th>
                    <th className="py-3 pr-4 font-semibold">Nominal</th>
                    <th className="py-3 pr-4 font-semibold">Jatuh Tempo</th>
                    <th className="py-3 pr-4 font-semibold">Status</th>
                    <th className="py-3 pr-4 font-semibold">Reminder</th>
                    <th className="py-3 font-semibold">Link</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.length === 0 ? (
                    <tr>
                      <td className="py-6 text-[#657086]" colSpan={7}>
                        Belum ada invoice. Klik Tagih Bulan Ini setelah DOKU
                        sandbox credential tersedia.
                      </td>
                    </tr>
                  ) : (
                    invoices.map((invoice) => (
                      <tr
                        key={invoice.id}
                        className="border-b border-[#eef2f6]"
                      >
                        <td className="py-3 pr-4 font-medium">
                          {memberById.get(invoice.memberId)?.name ??
                            invoice.memberId}
                        </td>
                        <td className="py-3 pr-4 text-[#657086]">
                          {invoice.period}
                        </td>
                        <td className="py-3 pr-4">
                          {formatRupiah(invoice.amount)}
                        </td>
                        <td className="py-3 pr-4 text-[#657086]">
                          {formatDate(invoice.dueDate)}
                        </td>
                        <td className="py-3 pr-4">
                          <InvoiceStatusBadge status={invoice.status} />
                        </td>
                        <td className="py-3 pr-4 text-[#657086]">
                          {invoice.reminderCount}x
                        </td>
                        <td className="py-3">
                          {invoice.paymentLink ? (
                            <a
                              className="font-medium text-[#33658a] underline-offset-2 hover:underline"
                              href={invoice.paymentLink}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Buka DOKU
                            </a>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel>
            <div className="flex flex-col gap-1 border-b border-[#e2e7ef] pb-4">
              <h2 className="text-lg font-semibold">Transaksi Terbaru</h2>
              <p className="text-sm text-[#657086]">
                Pemasukan DOKU dan pengeluaran kas komunitas.
              </p>
            </div>
            <div className="mt-4 space-y-3">
              {kasEntries.length === 0 ? (
                <p className="text-sm text-[#657086]">
                  Belum ada transaksi kas.
                </p>
              ) : (
                kasEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start justify-between gap-4 rounded-md border border-[#e2e7ef] bg-[#fbfcfe] px-3 py-3"
                  >
                    <div>
                      <div className="text-sm font-medium">
                        {entry.description}
                      </div>
                      <div className="mt-1 text-xs text-[#657086]">
                        {entry.category} · {formatDate(entry.date)}
                      </div>
                    </div>
                    <div
                      className={`shrink-0 text-sm font-semibold ${entry.type === "income" ? "text-[#236247]" : "text-[#9d2f2f]"}`}
                    >
                      {entry.type === "income" ? "+" : "-"}
                      {formatRupiah(entry.amount)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Panel>

          <Panel>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h2 className="text-lg font-semibold">Anggota Aktif</h2>
                <p className="text-sm text-[#657086]">
                  {members.filter((member) => member.isActive).length} anggota
                  siap ditagih.
                </p>
              </div>
              <div className="md:text-right">
                <div className="text-sm text-[#657086]">Iuran bulanan</div>
                <div className="text-xl font-semibold">
                  {formatRupiah(community.monthlyFee)}
                </div>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="rounded-md border border-[#e2e7ef] bg-[#fbfcfe] px-3 py-2"
                >
                  <div className="font-medium">{member.name}</div>
                  <div className="text-xs text-[#657086]">
                    {member.phone ?? "Nomor belum diisi"}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <aside className="space-y-5">
          <Panel>
            <h2 className="text-lg font-semibold">Kesiapan Demo</h2>
            <div className="mt-4 space-y-3 text-sm">
              <ChecklistItem
                done={dokuConfigured}
                label="DOKU sandbox credential"
              />
              <ChecklistItem
                done={invoices.length > 0}
                label="Invoice DOKU dibuat"
              />
              <ChecklistItem
                done={paid.length > 0}
                label="Pembayaran terdeteksi"
              />
              <ChecklistItem
                done={logs.some(
                  (log) => log.action === "monthly_report_generated",
                )}
                label="Laporan dibuat"
              />
            </div>
            {lastAction ? (
              <div className="mt-4 rounded-md border border-[#d7dde8] bg-[#f7f8fa] p-3 text-sm text-[#39465e]">
                {lastAction}
              </div>
            ) : null}
          </Panel>

          <Panel>
            <h2 className="text-lg font-semibold">Aktivitas Agent</h2>
            <div className="mt-4 space-y-3">
              {logs.length === 0 ? (
                <p className="text-sm text-[#657086]">
                  Belum ada aktivitas agent.
                </p>
              ) : (
                logs.slice(0, 6).map((log) => (
                  <div
                    key={log.id}
                    className="border-l-2 border-[#4f8a8b] pl-3"
                  >
                    <div className="text-sm font-medium">
                      {log.action.replaceAll("_", " ")}
                    </div>
                    <div className="text-xs text-[#657086]">
                      {formatDate(log.createdAt)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </aside>
      </section>
    </main>
  );
}

function LoadingState() {
  return (
    <main className="min-h-screen bg-[#f7f8fa] p-6 text-[#172033]">
      <div className="mx-auto max-w-7xl">
        <div className="h-8 w-48 animate-pulse rounded bg-[#dce2ec]" />
        <div className="mt-5 grid gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-28 animate-pulse rounded-lg bg-white"
            />
          ))}
        </div>
      </div>
    </main>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#dce2ec] bg-white p-5 shadow-sm">
      {children}
    </div>
  );
}

function ActionButton({
  children,
  disabled,
  onClick,
  variant = "primary",
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  variant?: "primary" | "secondary";
}) {
  const classes =
    variant === "primary"
      ? "bg-[#255f85] text-white hover:bg-[#1f5272]"
      : "border border-[#cdd6e3] bg-white text-[#172033] hover:bg-[#f2f5f8]";
  return (
    <button
      className={`min-h-10 rounded-md px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${classes}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function Metric({
  title,
  value,
  detail,
  tone,
}: {
  title: string;
  value: string;
  detail: string;
  tone: "green" | "blue" | "amber" | "red";
}) {
  const tones = {
    green: "border-l-[#2f7d59]",
    blue: "border-l-[#33658a]",
    amber: "border-l-[#b7791f]",
    red: "border-l-[#b23b3b]",
  };
  return (
    <div
      className={`rounded-lg border border-[#dce2ec] border-l-4 bg-white p-4 shadow-sm ${tones[tone]}`}
    >
      <div className="text-sm font-medium text-[#657086]">{title}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-[#657086]">{detail}</div>
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex rounded-full bg-[#e6f4ed] px-3 py-1 text-xs font-semibold text-[#236247]">
      DOKU sandbox aktif
    </span>
  ) : (
    <span className="inline-flex rounded-full bg-[#fff4df] px-3 py-1 text-xs font-semibold text-[#8a5a00]">
      DOKU env belum lengkap
    </span>
  );
}

function InvoiceStatusBadge({ status }: { status: Invoice["status"] }) {
  const styles = {
    paid: "bg-[#e6f4ed] text-[#236247]",
    pending: "bg-[#e8f1fb] text-[#255f85]",
    overdue: "bg-[#fdecec] text-[#9d2f2f]",
    cancelled: "bg-[#edf0f4] text-[#596579]",
  };
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[status]}`}
    >
      {status}
    </span>
  );
}

function ChecklistItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[#39465e]">{label}</span>
      <span
        className={`rounded-full px-2 py-1 text-xs font-semibold ${done ? "bg-[#e6f4ed] text-[#236247]" : "bg-[#edf0f4] text-[#596579]"}`}
      >
        {done ? "Siap" : "Belum"}
      </span>
    </div>
  );
}

type ChatMessage = {
  id: string;
  role: "user" | "agent";
  text: string;
  ts: number;
};

async function sendChatMessage(agentId: string, text: string): Promise<string> {
  const base = apiBase();
  const response = await fetch(`${base}/${agentId}/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      userId: "dashboard-user",
      roomId: "dashboard",
    }),
  });
  const data = await response.json().catch(() => []);
  if (Array.isArray(data) && data.length > 0) {
    return data.map((m: any) => m.text ?? "").join("\n");
  }
  if (data?.text) return data.text;
  return "Maaf, tidak ada respons dari agent.";
}

function ChatWidget() {
  const agentId = window.ELIZA_CONFIG?.agentId ?? "";
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "agent",
      text: "Halo! Saya BendaharaAI. Tanya apa saja tentang kas, iuran, atau invoice komunitas.",
      ts: Date.now(),
    },
  ]);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    const userMsg: ChatMessage = {
      id: randomId(),
      role: "user",
      text,
      ts: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);
    try {
      const reply = await sendChatMessage(agentId, text);
      setMessages((prev) => [
        ...prev,
        { id: randomId(), role: "agent", text: reply, ts: Date.now() },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: randomId(),
          role: "agent",
          text: "Gagal menghubungi agent. Pastikan server berjalan.",
          ts: Date.now(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <>
      <button
        aria-label={open ? "Tutup chat" : "Buka chat BendaharaAI"}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#255f85] text-white shadow-lg transition hover:bg-[#1f5272] focus:outline-none focus:ring-2 focus:ring-[#255f85] focus:ring-offset-2"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        {open ? (
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M4 4l12 12M16 4L4 16"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Chat BendaharaAI"
          className="fixed bottom-24 right-6 z-50 flex w-[360px] max-w-[calc(100vw-2rem)] flex-col rounded-xl border border-[#dce2ec] bg-white shadow-2xl"
          style={{ height: "480px" }}
        >
          <div className="flex items-center gap-3 rounded-t-xl border-b border-[#dce2ec] bg-[#255f85] px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm font-bold text-white">
              B
            </div>
            <div>
              <div className="text-sm font-semibold text-white">
                BendaharaAI
              </div>
              <div className="text-xs text-white/70">
                Bendahara digital komunitas
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-[#255f85] text-white rounded-br-sm"
                      : "bg-[#f2f5f8] text-[#172033] rounded-bl-sm"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-[#f2f5f8] px-3 py-2 text-sm text-[#657086]">
                  <span className="animate-pulse">Mengetik...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-[#dce2ec] px-3 py-3">
            <div className="flex items-center gap-2">
              <input
                aria-label="Pesan ke BendaharaAI"
                className="flex-1 rounded-lg border border-[#cdd6e3] bg-[#f7f8fa] px-3 py-2 text-sm text-[#172033] placeholder-[#9aa5b4] focus:border-[#255f85] focus:outline-none focus:ring-1 focus:ring-[#255f85]"
                disabled={sending}
                onKeyDown={onKey}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Tanya tentang kas, iuran, invoice..."
                type="text"
                value={input}
              />
              <button
                aria-label="Kirim pesan"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#255f85] text-white transition hover:bg-[#1f5272] disabled:opacity-50"
                disabled={sending || !input.trim()}
                onClick={() => void send()}
                type="button"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function randomId() {
  return Math.random().toString(36).slice(2);
}

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(<AppShell />);
}

export interface AgentPanel {
  name: string;
  path: string;
  component: React.ComponentType<any>;
  icon?: string;
  public?: boolean;
  shortLabel?: string;
}

interface PanelProps {
  agentId: string;
}

const PanelComponent: React.FC<PanelProps> = () => (
  <QueryClientProvider client={queryClient}>
    <KomunitasDashboard />
  </QueryClientProvider>
);

export const panels: AgentPanel[] = [
  {
    name: "KomunitasAI",
    path: "komunitas",
    component: PanelComponent,
    icon: "WalletCards",
    public: false,
    shortLabel: "Kas",
  },
];

export * from "./utils";
