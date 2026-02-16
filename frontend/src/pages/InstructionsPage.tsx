import {
  GraduationCap,
  ClipboardCheck,
  FileDown,
  ScanLine,
  BarChart3,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Printer,
  Camera,
} from 'lucide-react'

const steps = [
  {
    number: 1,
    title: 'Create a Class',
    description: 'Set up your class with a name, subject, and total number of items for the exam.',
    icon: GraduationCap,
    color: 'bg-indigo-100 text-indigo-600',
    tips: [
      'Choose the total items carefully — this determines how many bubbles to fill in the answer key.',
      'The PDF will always print all 100 bubbles, but only your total items will be scored.',
    ],
  },
  {
    number: 2,
    title: 'Create the Answer Key',
    description: 'Fill in the correct answer for every question. All items must be completed before saving.',
    icon: ClipboardCheck,
    color: 'bg-emerald-100 text-emerald-600',
    tips: [
      'Click a bubble to select it; click again to deselect.',
      'You can also import answers from a CSV file (format: q1,A).',
      'The counter turns green when all items are filled.',
    ],
  },
  {
    number: 3,
    title: 'Generate & Print the PDF',
    description: 'Download the OMR answer sheet PDF. The exam name and total items are auto-filled from your class.',
    icon: FileDown,
    color: 'bg-amber-100 text-amber-600',
    tips: [
      'Print on white A4 or Letter paper at 100% scale (no scaling).',
      'Make sure the four corner markers are clearly visible after printing.',
      'Distribute the sheets to students for the exam.',
    ],
  },
  {
    number: 4,
    title: 'Scan the Sheets',
    description: 'Upload a photo or scan of each completed answer sheet. Enter the student name and select the answer key.',
    icon: ScanLine,
    color: 'bg-blue-100 text-blue-600',
    tips: [
      'Take clear, well-lit photos — avoid shadows over the bubbles.',
      'Keep the sheet flat and capture all four corner markers.',
      'Use the Scan tab inside your class, or the main Scan page.',
    ],
  },
  {
    number: 5,
    title: 'View & Export Grades',
    description: 'Check each student\'s score in the Student Grades tab. Export everything to Excel with one click.',
    icon: BarChart3,
    color: 'bg-violet-100 text-violet-600',
    tips: [
      'Grades are auto-saved after every scan.',
      'Delete incorrect entries if a scan went wrong.',
      'Export to Excel for your gradebook or reporting.',
    ],
  },
]

export default function InstructionsPage() {
  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Hero */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">How to Use OMR Scanner</h1>
        <p className="text-gray-500 mt-2 text-lg">
          Follow these steps to create, scan, and grade your exams.
        </p>
      </div>

      {/* Flow overview */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        {steps.map((step, i) => {
          const Icon = step.icon
          return (
            <div key={step.number} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${step.color}`}>
                <Icon className="h-3.5 w-3.5" />
                {step.title}
              </div>
              {i < steps.length - 1 && (
                <ArrowRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
              )}
            </div>
          )
        })}
      </div>

      {/* Detailed steps */}
      <div className="space-y-6">
        {steps.map((step) => {
          const Icon = step.icon
          return (
            <div key={step.number} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-start gap-4 p-6">
                <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${step.color}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Step {step.number}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mt-1">{step.title}</h3>
                  <p className="text-gray-500 mt-1">{step.description}</p>
                  <div className="mt-4 space-y-2">
                    {step.tips.map((tip, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-gray-600">
                        <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>{tip}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Tips section */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-900">Tips for Best Results</h3>
            <ul className="mt-2 space-y-1.5 text-sm text-amber-800">
              <li className="flex items-start gap-2">
                <Printer className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>Print answer sheets at <strong>100% scale</strong> on white paper. Scaling will break marker detection.</span>
              </li>
              <li className="flex items-start gap-2">
                <Camera className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>When photographing sheets, ensure <strong>even lighting</strong> and all <strong>four corner markers</strong> are visible.</span>
              </li>
              <li className="flex items-start gap-2">
                <ScanLine className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>Students should <strong>fill bubbles completely</strong> with dark ink or pencil. Light marks may not be detected.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
