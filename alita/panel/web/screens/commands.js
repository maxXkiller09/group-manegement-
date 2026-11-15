import { toast, textElement } from "../ui.js";

const commandGroups = [
  {
    title: "Moderation",
    commands: [
      ["/ban", "Kisi member ko group se remove karke dobara join hone se rokta hai.", "admin", "/ban @username reason"],
      ["/tban", "Member ko sirf diye gaye time ke liye ban karta hai.", "admin", "/tban @username 1d reason"],
      ["/unban", "Pehle ban kiye gaye member ko wapas join karne deta hai.", "admin", "/unban @username"],
      ["/kick", "Member ko group se remove karta hai; woh dobara join kar sakta hai.", "admin", "/kick @username reason"],
      ["/mute", "Member ke messages bhejne ki permission rokta hai.", "admin", "/mute @username reason"],
      ["/tmute", "Member ko limited time ke liye mute karta hai.", "admin", "/tmute @username 1h reason"],
      ["/unmute", "Member ka mute hatata hai.", "admin", "/unmute @username"],
      ["/warn", "Member ko rule todne par warning deta hai.", "admin", "/warn @username reason"],
      ["/warns", "Warnings ki list ya apni warning details dikhata hai.", "member", "/warns"],
      ["/rmwarn", "Member ki ek warning remove karta hai.", "admin", "/rmwarn @username"],
    ],
  },
  {
    title: "Group protection",
    commands: [
      ["/antiraid", "Join raid ke dauran group ko temporary protection mode mein rakhta hai.", "admin", "/antiraid"],
      ["/setflood", "Ek saath bahut messages bhejne par action set karta hai.", "admin", "/setflood 5"],
      ["/setfloodmode", "Flood detect hone par kya action lena hai, set karta hai.", "admin", "/setfloodmode mute"],
      ["/captcha", "Naye members ke liye verification settings manage karta hai.", "admin", "/captcha"],
      ["/aispam", "Automatic spam detection settings manage karta hai.", "admin", "/aispam"],
      ["/lock", "Group ke selected message type ko members ke liye lock karta hai.", "admin", "/lock url"],
      ["/unlock", "Pehle lagaya gaya selected lock hataata hai.", "admin", "/unlock url"],
      ["/blacklists", "Blocked words aur unke automatic actions manage karta hai.", "admin", "/blacklists"],
    ],
  },
  {
    title: "Group tools",
    commands: [
      ["/setrules", "Group ke rules set ya update karta hai.", "admin", "/setrules Be respectful"],
      ["/rules", "Group ke rules members ko dikhata hai.", "member", "/rules"],
      ["/setwelcome", "Naye members ke liye welcome message set karta hai.", "admin", "/setwelcome Welcome {first}"],
      ["/welcome", "Welcome message settings dekhta ya update karta hai.", "admin", "/welcome"],
      ["/filters", "Keyword-based automatic replies manage karta hai.", "admin", "/filters"],
      ["/notes", "Saved notes ki list dikhata hai.", "member", "/notes"],
      ["/setlog", "Group activity log ke liye channel connect karta hai.", "admin", "/setlog"],
      ["/adminlist", "Group ke admins ki list dikhata hai.", "member", "/adminlist"],
      ["/invitelink", "Group ka invite link dikhata hai.", "member", "/invitelink"],
      ["/connect", "Private chat ko group se connect karne ka setup shuru karta hai.", "member", "/connect"],
    ],
  },
];

const manageRoutes = {
  "/filters": "filters",
  "/notes": "notes",
  "/blacklists": "blacklists",
  "/welcome": "settings",
  "/setwelcome": "settings",
  "/setrules": "settings",
  "/setlog": "settings",
  "/antiraid": "settings",
  "/captcha": "settings",
  "/aispam": "settings",
  "/setflood": "settings",
  "/setfloodmode": "settings",
  "/lock": "settings",
  "/unlock": "settings",
};

function commandCard(command, chatID) {
  const [name, description, access, example] = command;
  const card = document.createElement("article");
  card.className = "callout command-card";
  const head = document.createElement("div");
  head.className = "command-card-head";
  head.append(textElement("strong", name), textElement("span", access === "admin" ? "Admin" : "Sabhi members", "pill accent"));
  card.append(head, textElement("p", description, "command-description"));
  const exampleRow = document.createElement("div");
  exampleRow.className = "command-example";
  exampleRow.append(textElement("code", example));
  const copy = textElement("button", "Copy command");
  copy.type = "button";
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(example);
      toast("Command copy ho gaya. Group mein paste karke send karein.");
    } catch {
      toast("Clipboard access nahi mila. Command ko manually copy karein.", "error");
    }
  });
  exampleRow.append(copy);
  card.append(exampleRow);
  const route = manageRoutes[name];
  if (route) {
    const manage = textElement("a", "Mini App mein manage karein  ›", "command-manage");
    manage.href = `#/chats/${encodeURIComponent(chatID)}/${route}`;
    card.append(manage);
  }
  return card;
}

export function renderCommands(root, chatID, chat) {
  root.append(
    textElement("p", "Har command ka kaam Hinglish mein samjhein. Example copy karke group mein bhejein; supported settings ko yahin Mini App mein manage karein.", "callout"),
  );

  const search = document.createElement("input");
  search.type = "search";
  search.placeholder = "Command ya feature search karein…";
  search.setAttribute("aria-label", "Search commands");
  root.append(search);

  const results = document.createElement("div");
  results.className = "command-groups";
  root.append(results);

  function draw(query = "") {
    while (results.firstChild) results.removeChild(results.firstChild);
    const needle = query.trim().toLocaleLowerCase();
    let count = 0;
    for (const group of commandGroups) {
      const matches = group.commands.filter((command) =>
        (chat?.role === "admin" || command[2] !== "admin") &&
        command.join(" ").toLocaleLowerCase().includes(needle),
      );
      if (matches.length === 0) continue;
      results.append(textElement("h2", group.title, "section-header"));
      for (const command of matches) {
        results.append(commandCard(command, chatID));
        count += 1;
      }
    }
    if (count === 0) {
      results.append(textElement("p", "Is search se koi command nahi mili.", "empty"));
    }
  }

  search.addEventListener("input", () => draw(search.value));
  draw();
}
