const navigationItems = [
  {
    label: "Overview",
    path: "/",
    roles: [
      "owner",
      "manager",
      "cashier",
      "barista",
      "inventory staff",
    ],
  },
  {
    label: "Point of sale",
    path: "/pos",
    roles: ["owner", "manager", "cashier"],
  },
  {
    label: "Orders",
    path: "/orders",
    roles: [
      "owner",
      "manager",
      "cashier",
      "barista",
    ],
  },
  {
    label: "Drink preparation",
    path: "/preparation",
    roles: ["owner", "manager", "barista"],
  },
  {
    label: "Menu",
    path: "/menu",
    roles: ["owner", "manager"],
  },
  {
    label: "Stock",
    path: "/inventory",
    roles: [
      "owner",
      "manager",
      "inventory staff",
    ],
  },
  {
    label: "Purchasing",
    path: "/purchasing",
    roles: [
      "owner",
      "manager",
      "inventory staff",
    ],
  },
  {
    label: "Reports",
    path: "/reports",
    roles: ["owner", "manager"],
  },
  {
    label: "Team",
    path: "/team",
    roles: ["owner"],
  },
  {
    label: "Settings",
    path: "/settings",
    roles: ["owner"],
  },
];


export function getNavigationForUser(user) {
  const userRoles = new Set(
    user.roles.map((role) =>
      role.role_name.toLowerCase(),
    ),
  );

  return navigationItems.filter((item) =>
    item.roles.some((role) => userRoles.has(role)),
  );
}