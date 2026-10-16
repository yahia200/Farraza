/**
 * The address of a file's preview page (app/(viewer)/dashboard/[companySlug]/jobs/[jobSlug]/candidates/
 * [applicationId]/files/[fileId]). It carries only ids; the page loads the file's details and mints
 * the view link itself, so nothing secret or short-lived ever goes into the URL.
 */
export function filePreviewHref(file: {
  companySlug: string;
  jobSlug: string;
  applicationId: string;
  fileId: string;
}) {
  const [company, job, application, id] = [file.companySlug, file.jobSlug, file.applicationId, file.fileId].map(
    encodeURIComponent,
  );
  return `/dashboard/${company}/jobs/${job}/candidates/${application}/files/${id}`;
}
