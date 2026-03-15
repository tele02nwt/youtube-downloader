function isAdminSession(session) {
  return session?.role === 'admin';
}

function getScopedUserId(session) {
  if (isAdminSession(session)) {
    return undefined;
  }
  return session?.userId || null;
}

function canAccessRecord(record, session) {
  if (isAdminSession(session)) {
    return true;
  }
  if (!record) {
    return false;
  }
  return record.userId === getScopedUserId(session);
}

function filterRecordsForSession(records, session, options = {}) {
  if (!Array.isArray(records)) {
    return [];
  }
  if (isAdminSession(session)) {
    return records;
  }

  const scopedUserId = getScopedUserId(session);
  const includeShared = !!options.includeShared;
  const sharedPredicate = options.sharedPredicate || (() => false);

  return records.filter(record => {
    if (record?.userId === scopedUserId) {
      return true;
    }
    return includeShared && sharedPredicate(record);
  });
}

function filterFilesForSession(files, downloads, session) {
  if (isAdminSession(session)) {
    return files;
  }

  const allowedPaths = new Set(
    filterRecordsForSession(downloads, session).map(download => download.localPath).filter(Boolean)
  );

  return files.filter(file => allowedPaths.has(file.path));
}

function canAccessFilePath(filePath, downloads, session) {
  if (isAdminSession(session)) {
    return true;
  }

  return filterRecordsForSession(downloads, session).some(download => download.localPath === filePath);
}

module.exports = {
  isAdminSession,
  getScopedUserId,
  canAccessRecord,
  filterRecordsForSession,
  filterFilesForSession,
  canAccessFilePath
};
