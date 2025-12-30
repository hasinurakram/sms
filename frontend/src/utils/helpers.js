export const getRoleTitle = (role) => role ? role.charAt(0).toUpperCase() + role.slice(1) : '';
export const getRoleColor = (role) => {
  switch(role) {
    case "teacher": return "#2e7d32";
    case "student": return "#9c27b0";
    case "parent": return "#f57c00";
    case "committee": return "#6d4c41";
    default: return "#1976d2";
  }
}