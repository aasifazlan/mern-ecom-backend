import express from 'express';
import dotenv from 'dotenv'
import cors from 'cors';
import authRoutes from './routes/auth.route.js'
import productRoutes from './routes/product.route.js'
import cartRoutes from './routes/cart.route.js'
import couponRoutes from './routes/coupon.route.js'
import paymentRoutes from './routes/payment.route.js'
import analyticsRoutes from './routes/analytics.route.js'
import { connectDB } from './lib/db.js';
import cookieParser from 'cookie-parser';
dotenv.config()

const app = express();

const allowedOrigins = [
  'https://mern-ecom-frontend-indol.vercel.app',
  'http://localhost:5173'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.get('/ping', (req, res) => {
  res.json({
    message: 'pong',
    origin: req.headers.origin
  });
});


app.use((req, res, next) => {
  console.log('Incoming request origin:', req.headers.origin);
  next();
});

 

app.use((req, res, next) => {
  console.log('CORS Headers:', res.getHeaders());
  next();
});


app.use(express.json({limit: "10mb"})); // this allow you to parse the body of the request
app.use(cookieParser()); // 
const PORT=process.env.PORT ||5000

app.listen(PORT, ()=>{
    console.log('Server is running on http://localhost:' + PORT );
     connectDB();
})

// mongoose.connect(process.env.MONGO_URL)
// .then(()=> console.log('Database is connected'))
// .catch((error)=>console.log(error))

//authentication

app.use('/api/auth', authRoutes )
app.use('/api/products', productRoutes )
app.use('/api/cart', cartRoutes )
app.use('/api/coupons', couponRoutes )
app.use('/api/payments', paymentRoutes )
app.use('/api/analytics', analyticsRoutes )