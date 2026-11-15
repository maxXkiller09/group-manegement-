import { toast, textElement } from "../ui.js";

const commandGroups = [
  {
    title: "Moderation",
    commands: [
      ["/ban", "Kisi member ko group se remove karke dobara join hone se rokta hai.", "Admin", "/ban @username reason"],
      ["/tban", "Member ko sirf diye gaye time ke liye ban karta hai.", "Admin", "/tban @username 1d reason"],
      ["/unban", "Pehle ban kiye gaye member ko wapas join karne deta hai.", "Admin", "/unban @username"],
      ["/kick", "Member ko group se remove karta hai; woh dobara join kar sakta hai.", "Admin", "/kick @username reason"],
      ["/mute", "Member ke messages bhejne ki permission rokta hai.", "Admin", "/mute @username reason"],
      ["/tmute", "Member ko limited time ke liye mute karta hai.", "Admin", "/tmute @username 1h reason"],
      ["/unmute", "Member ka mute hatata hai.", "Admin", "/unmute @username"],
      ["/warn", "Member ko rule todne par warning deta hai.", "Admin", "/warn @username reason"],
      ["/warns", "Warnings ki list ya apni warning details dikhata hai.", "Member / Admin", "/warns"],
      ["/rmwarn", "Member ki ek warning remove karta hai.", "Admin", "/rmwarn @username"],
    ],
  },
  {
    title: "Group protection",
    commands: [
      ["/antiraid", "Join raid ke dauran group ko temporary protection mode mein rakhta hai.", "Admin", "/antiraid"],
      ["/setflood", "Ek saath bahut messages bhejne par action set karta hai.", "Admin", "/setflood 5"],
      ["/setfloodmode", "Flood detect hone par kya action lena hai, set karta hai.", "Admin", "/setfloodmode mute"],
      ["/captcha", "Naye members ke liye verification settings manage karta hai.", "Admin", "/captcha"],
      ["/aispam", "Automatic spam detection settings manage karta hai.", "Admin", "/aispam"],
      ["/lock", "Group ke selected message type ko members ke liye lock karta hai.", "Admin", "/lock url"],
      ["/unlock", "Pehle lagaya gaya selected lock hataata hai.", "Admin", "/unlock url"],
      ["/blacklists", "Blocked words aur unke automatic actions manage karta hai.", "Admin", "/blacklists"],
    ],
  },
  {
    title: "Group tools",
    commands: [
      ["/setrules", "Group ke rules set ya update karta hai.", "Admin", "/setrules Be respectful"],
      ["/rules", "Group ke rules members ko dikhata hai.", "Member", "/rules"],
      ["/setwelcome", "Naye members ke liye welcome message set karta hai.", "Admin", "/setwelcome Welcome {first}"],
      ["/welcome", "Welcome message settings dekhta ya update karta hai.", "Admin", "/welcome"],
      ["/filters", "Keyword-based automatic replies manage karta hai.", "Admin", "/filters"],
      ["/notes", "Saved notes ki list dikhata hai.", "Member / Admin", "/notes"],
      ["/setlog", "Group activity log ke liye channel connect karta hai.", "Admin", "/setlog"],
      ["/adminlist", "Group ke admins ki list dikhata hai.", "Member", "/adminlist"],
      ["/invitelink", "Group ka invite link dikhata hai.", "Member / Admin", "/invitelink"],
      ["/connect", "Private chat ko group se connect karne ka setup shuru karta hai.", "Member / Admin", "/connect"],
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
  head.append(textElement("strong", name), textElement("span", access, "pill accent"));
  card.append(head, textElement("p", description, "command-description"));
  const exampleRow = document.createElement("div");
  exampleRow.className = "command-example";
  exampleRow.append(textElement("code", example));
  const copy = textElement("button", "Copy command");
  copy.type = "button";
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(example);
      toast("Command copied. Group mein paste karke send karein.");
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

export function renderCommands(root, chatID) {
  root.append(
    textElement("p", "Har command ka kaam Hinglish mein samjhein. Example copy karke group mein bhej sakte hain; supported settings ko yahin Mini App mein manage karein.", "callout"),
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
