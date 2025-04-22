router.post("/log-activity", firebaseAuth, async (req, res) => {
   const { caloriesLogged, details } = req.body.data;
   const email = req.user.email;
   const today = new Date().toISOString().split("T")[0];

   try {
      const user = await User.findOne({ email });
      if (!user) return res.status(404).json({ message: "User not found" });

      let metric = await Metric.findOne({ userId: user._id });
      if (!metric) {
         metric = new Metric({ userId: user._id });
      }

      const existingLog = await Log.findOne({ userId: user._id.toString(), date: today });
      if (existingLog) {
         return res.status(400).json({ message: "Already logged today" });
      }

      let streakUpdated = false;

      if (user.goal === "lose" && caloriesLogged <= user.calorieGoal + 100) {
         metric.streak += 1;
         streakUpdated = true;
      } else if (user.goal === "gain" && caloriesLogged >= user.calorieGoal - 200) {
         metric.streak += 1;
         streakUpdated = true;
      } else if (
         user.goal === "maintain" &&
         caloriesLogged >= user.calorieGoal - 200 &&
         caloriesLogged <= user.calorieGoal + 200
      ) {
         metric.streak += 1;
         streakUpdated = true;
      }

      if (!streakUpdated) {
         const missedAlready = metric.missedDays.find((d) => d === today);
         if (!missedAlready) {
            metric.missedDays.push(today);
            if (metric.missedDays.length === 2) {
               metric.streak = 0;
            } else {
               metric.streak -= 1;
            }
         }
      }

      metric.lastLoggedDate = today;
      await metric.save();

      const newLog = new Log({
         userId: user._id.toString(),
         username: user.username,
         journeyType: "calorie tracking",
         date: today,
         data: { caloriesLogged, details },
      });
      await newLog.save();

      res.json({ message: "Log saved successfully", streak: metric.streak });
   } catch (err) {
      console.error("Log saving failed:", err);
      res.status(500).json({ message: "Failed to save log" });
   }
});
